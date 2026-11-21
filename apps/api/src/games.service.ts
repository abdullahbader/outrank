import { randomBytes, randomInt } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  apply, buildView, createGame, finalSummary, selectQuestions, shuffle,
  type Action, type Actor, type GameEvent, type GameState, type Viewer,
} from '@outrank/shared';
import { GameError, hashToken, newToken } from './auth';
import { config } from './config';
import { ContentService } from './content.service';
import { PrismaService } from './prisma.service';
import { RealtimeService } from './realtime.service';

const BOT_COLORS = ['#3F8F65', '#75AFC5', '#E8C66A', '#D4876F', '#8E7CC3', '#5E9E8F', '#C8614F', '#6F8FB8', '#B5A04A', '#A0789A'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const randomCode = (n: number) => Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export type ActionResult = { ok: true; version: number } | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

@Injectable()
export class GamesService {
  private readonly log = new Logger('Games');
  private joinAttempts = new Map<string, number[]>();
  /** Dev-only practice games: the phone practising as a player, and the autopilot timer. */
  private practice = new Map<string, { playerDeviceId: string; timer?: NodeJS.Timeout }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly realtime: RealtimeService,
  ) {}

  // ───────────── setup

  async create(deviceId: string, categories: string[]) {
    const state = createGame({
      now: Date.now(),
      categories,
      config: { minQuestions: config.minQuestions, maxPlayers: config.maxPlayers, targetScore: config.targetScore },
    });
    const recovery = randomCode(8);
    for (let i = 0; i < 10; i++) {
      try {
        const game = await this.prisma.game.create({
          data: {
            code: randomCode(6),
            hostDeviceId: deviceId,
            categories,
            state: state as unknown as Prisma.InputJsonValue,
            hostRecoveryHash: hashToken(recovery),
          },
        });
        return { gameId: game.id, code: game.code, hostRecoveryCode: recovery };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // code clash, retry
        throw e;
      }
    }
    throw new GameError('CODE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE);
  }

  async byCode(code: string) {
    const game = await this.prisma.game.findFirst({
      where: { code: code.trim().toUpperCase(), status: { in: ['lobby', 'playing'] } },
      include: { host: { select: { displayName: true } } },
    });
    if (!game) throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    const s = game.state as unknown as GameState;
    return {
      gameId: game.id,
      code: game.code,
      status: game.status,
      hostName: game.host.displayName,
      categories: s.categories,
      playerCount: s.players.length,
      maxPlayers: s.config.maxPlayers,
    };
  }

  private rateLimitJoin(deviceId: string) {
    const now = Date.now();
    const list = (this.joinAttempts.get(deviceId) ?? []).filter((t) => now - t < 60_000);
    list.push(now);
    this.joinAttempts.set(deviceId, list);
    if (list.length > config.joinAttemptsPerMinute) throw new GameError('TOO_MANY_ATTEMPTS', HttpStatus.TOO_MANY_REQUESTS);
  }

  async join(gameId: string, deviceId: string, name: string, isBot = false, botColor?: string) {
    if (!isBot) this.rateLimitJoin(deviceId);
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (game.hostDeviceId === deviceId) throw new GameError('HOST_CANNOT_JOIN');
    const existing = await this.prisma.gameParticipant.findFirst({ where: { gameId, deviceId, removedAt: null } });
    if (existing) return { playerId: existing.playerId, rejoined: true };

    const playerId = `p_${randomBytes(6).toString('hex')}`;
    const color = botColor ?? (await this.prisma.device.findUnique({ where: { id: deviceId }, select: { avatarColor: true } }))?.avatarColor ?? undefined;
    let res: ActionResult;
    try {
      res = await this.runAction(gameId, { role: 'system' }, { type: 'join', playerId, name, color }, null, async (tx) => {
        await tx.gameParticipant.create({ data: { gameId, playerId, deviceId, displayName: name.trim().replace(/\s+/g, ' '), isBot } });
      });
    } catch (e) {
      // Same phone tapped Join twice at once: the second insert loses the race — return the first.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const p = await this.prisma.gameParticipant.findFirst({ where: { gameId, deviceId, removedAt: null } });
        if (p) return { playerId: p.playerId, rejoined: true };
        throw new GameError('NAME_TAKEN');
      }
      throw e;
    }
    if (!res.ok) throw new GameError(res.error);
    if (!isBot) await this.prisma.device.update({ where: { id: deviceId }, data: { displayName: name.trim() } }).catch(() => {});
    return { playerId, rejoined: false };
  }

  async recoverHost(gameId: string, deviceId: string, code: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status === 'finished' || game.status === 'abandoned') throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (game.hostRecoveryHash !== hashToken(code.trim().toUpperCase())) throw new GameError('WRONG_RECOVERY_CODE', HttpStatus.FORBIDDEN);
    const isPlayer = await this.prisma.gameParticipant.findFirst({ where: { gameId, deviceId, removedAt: null } });
    if (isPlayer) throw new GameError('HOST_CANNOT_JOIN');
    await this.prisma.game.update({ where: { id: gameId }, data: { hostDeviceId: deviceId } });
    await this.prisma.gameEvent.create({ data: { gameId, seq: await this.nextSeq(this.prisma, gameId), type: 'host_recovered', actor: 'host', payload: { deviceId } } });
    await this.broadcast(gameId, []);
    return { ok: true };
  }

  /** Who is this device in this game? */
  async actorFor(gameId: string, deviceId: string): Promise<{ actor: Actor; viewer: Viewer }> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { hostDeviceId: true } });
    if (!game) throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    if (game.hostDeviceId === deviceId) return { actor: { role: 'host' }, viewer: { role: 'host' } };
    const p = await this.prisma.gameParticipant.findFirst({ where: { gameId, deviceId, removedAt: null } });
    if (!p) throw new GameError('NOT_IN_GAME', HttpStatus.FORBIDDEN);
    return { actor: { role: 'player', playerId: p.playerId }, viewer: { role: 'player', playerId: p.playerId } };
  }

  async view(gameId: string, viewer: Viewer) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.render(game.id, game.code, game.version, game.state as unknown as GameState, viewer, game.hostRecoveryHash);
  }

  private async render(gameId: string, code: string, version: number, s: GameState, viewer: Viewer, _recovery?: string) {
    const ids = [...new Set(s.rounds.map((r) => r.questionId))];
    const questions = await this.content.load(ids);
    const presence = await this.realtime.presence(gameId);
    return { gameId, code, version, ...buildView(s, questions, viewer), ...presence, practice: this.practice.has(gameId) };
  }

  // ───────────── the one door every game action goes through

  async runAction(
    gameId: string,
    actor: Actor,
    action: Action,
    clientActionId: string | null,
    extra?: (tx: Tx, state: GameState) => Promise<void>,
  ): Promise<ActionResult> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ state: GameState; version: number; status: string }[]>`
        SELECT state, version, status FROM games WHERE id = ${gameId} FOR UPDATE`;
      if (!rows.length) return { result: { ok: false, error: 'GAME_NOT_FOUND' } as ActionResult, events: [] as GameEvent[] };
      const row = rows[0];

      if (clientActionId) {
        const seen = await tx.gameAction.findUnique({ where: { gameId_clientActionId: { gameId, clientActionId } } });
        if (seen) return { result: seen.result as unknown as ActionResult, events: [], duplicate: true };
      }

      let act = action;
      if (action.type === 'start') {
        const prepared = await this.prepareQuestions(tx, gameId, row.state);
        if (!prepared.ok) return { result: prepared as ActionResult, events: [] };
        act = { type: 'start', questionIds: prepared.ids };
      }

      const r = apply(row.state, actor, act, Date.now());
      let result: ActionResult;
      let events: GameEvent[] = [];
      if (!r.ok) {
        result = { ok: false, error: r.error };
      } else {
        const version = row.version + 1;
        const status = r.state.phase === 'lobby' ? 'lobby' : r.state.phase === 'finished' ? 'finished' : 'playing';
        await tx.game.update({
          where: { id: gameId },
          data: {
            state: r.state as unknown as Prisma.InputJsonValue,
            version,
            status,
            categories: r.state.categories,
            finishedAt: status === 'finished' ? new Date() : undefined,
          },
        });
        let seq = await this.nextSeq(tx, gameId);
        const actorLabel = actor.role === 'player' ? `player:${actor.playerId}` : actor.role;
        if (r.events.length) {
          await tx.gameEvent.createMany({
            data: r.events.map((e) => ({ gameId, seq: seq++, type: e.type, actor: actorLabel, payload: e as unknown as Prisma.InputJsonValue })),
          });
        }
        if (action.type === 'remove_player' || action.type === 'leave') {
          const pid = action.type === 'leave' && actor.role === 'player' ? actor.playerId : (action as { playerId: string }).playerId;
          await tx.gameParticipant.updateMany({ where: { gameId, playerId: pid, removedAt: null }, data: { removedAt: new Date() } });
        }
        if (extra) await extra(tx, r.state);
        if (status === 'finished' && row.status !== 'finished') await this.writeResults(tx, gameId, r.state);
        result = { ok: true, version };
        events = r.events;
      }
      if (clientActionId) {
        await tx.gameAction.create({ data: { gameId, clientActionId, result: result as unknown as Prisma.InputJsonValue } });
      }
      return { result, events };
    });

    if (outcome.result.ok && !('duplicate' in outcome && outcome.duplicate)) {
      await this.broadcast(gameId, outcome.events);
      if (this.practice.has(gameId)) this.autopilot(gameId);
    }
    return outcome.result;
  }

  private async nextSeq(tx: Tx | PrismaService, gameId: string) {
    const last = await tx.gameEvent.aggregate({ where: { gameId }, _max: { seq: true } });
    return (last._max.seq ?? 0) + 1;
  }

  /** Brief §9B: read categories, find ready questions, select, no duplicates, random order, store. */
  private async prepareQuestions(tx: Tx, gameId: string, s: GameState): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
    if (!s.categories.length) return { ok: false, error: 'NO_CATEGORIES' };
    const pool = await tx.question.findMany({
      where: { categoryId: { in: s.categories }, status: 'active', verification: 'verified' },
      select: { id: true, categoryId: true },
    });
    const rng = () => randomInt(0, 2 ** 31) / 2 ** 31;
    const picked = selectQuestions(pool, s.categories, config.questionsPerGame, rng);
    if (picked.length < s.config.minQuestions) return { ok: false, error: 'NOT_ENOUGH_QUESTIONS' };
    const ids = shuffle(picked, rng);
    await tx.gameQuestion.deleteMany({ where: { gameId } });
    await tx.gameQuestion.createMany({ data: ids.map((questionId, position) => ({ gameId, position, questionId })) });
    return { ok: true, ids };
  }

  private async writeResults(tx: Tx, gameId: string, s: GameState) {
    const summary = finalSummary(s);
    const parts = await tx.gameParticipant.findMany({ where: { gameId, removedAt: null } });
    const byPlayer = new Map(parts.map((p) => [p.playerId, p]));
    const rows = summary.players
      .map((p) => ({ p, part: byPlayer.get(p.id) }))
      .filter((x) => x.part && !x.part.isBot)
      .map(({ p, part }) => ({
        gameId,
        deviceId: part!.deviceId,
        playerId: p.id,
        finalRank: p.position,
        finalScore: p.score,
        won: p.won,
        answersClaimed: p.answersClaimed,
        pointsGained: p.pointsGained,
        pointsLost: p.pointsLost,
        cardsUsed: p.cardsUsed,
      }));
    if (rows.length) await tx.gameResult.createMany({ data: rows, skipDuplicates: true });
  }

  // ───────────── live updates

  async broadcast(gameId: string, events: GameEvent[]) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return;
    const s = game.state as unknown as GameState;
    const sockets = await this.realtime.socketsIn(gameId);
    const hostView = await this.render(game.id, game.code, game.version, s, { role: 'host' });
    for (const { socket, id } of sockets) {
      const isHost = id.role === 'host' && id.deviceId === game.hostDeviceId;
      const view = isHost
        ? hostView
        : id.playerId
          ? await this.render(game.id, game.code, game.version, s, { role: 'player', playerId: id.playerId })
          : null;
      if (view) socket.emit('game:state', { version: game.version, view, events });
    }
  }

  // ───────────── host presence → auto pause

  async onHostPresence(gameId: string, online: boolean) {
    if (online) { this.realtime.clearHostTimer(gameId); return; }
    this.realtime.setHostTimer(gameId, config.hostGraceMs, async () => {
      const p = await this.realtime.presence(gameId);
      if (p.hostOnline) return;
      const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
      if (game?.status !== 'playing') return;
      const r = await this.runAction(gameId, { role: 'system' }, { type: 'pause' }, null);
      if (r.ok) this.log.log(`Game ${gameId} paused: host offline`);
    });
  }

  // ───────────── stats

  async stats(deviceId: string) {
    const rows = await this.prisma.gameResult.findMany({ where: { deviceId }, orderBy: { at: 'desc' } });
    const played = rows.length;
    const won = rows.filter((r) => r.won).length;
    return {
      gamesPlayed: played,
      gamesWon: won,
      winRate: played ? Math.round((won / played) * 100) : 0,
      highestScore: played ? Math.max(...rows.map((r) => r.finalScore)) : 0,
      averageScore: played ? Math.round(rows.reduce((n, r) => n + r.finalScore, 0) / played) : 0,
      recent: rows.slice(0, 20).map((r) => ({ gameId: r.gameId, at: r.at, score: r.finalScore, rank: r.finalRank, won: r.won })),
    };
  }

  async results(gameId: string, viewer: Viewer) {
    const v = await this.view(gameId, viewer);
    if (v.phase !== 'finished') throw new GameError('GAME_NOT_FINISHED');
    return v;
  }

  // ───────────── dev tools: practise as a player (one phone, automatic host and test players)

  async startPractice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    const hostDevice = await this.prisma.device.create({ data: { tokenHash: hashToken(newToken()), displayName: 'Practice host' } });
    const ready = await this.prisma.question.groupBy({ by: ['categoryId'], where: { status: 'active', verification: 'verified' } });
    const { gameId } = await this.create(hostDevice.id, ready.map((r) => r.categoryId));
    this.practice.set(gameId, { playerDeviceId: deviceId });
    await this.addBots(gameId, 4);
    await this.join(gameId, deviceId, device?.displayName?.trim() || 'Player');
    const r = await this.runAction(gameId, { role: 'host' }, { type: 'start', questionIds: [] }, null);
    if (!r.ok) { this.practice.delete(gameId); throw new GameError(r.error); }
    return { gameId };
  }

  /** In a practice game the phone's owner may also act as the host (to rule on their own answers). */
  async practiceHostAct(gameId: string, deviceId: string, action: Action) {
    const p = this.practice.get(gameId);
    if (!p || p.playerDeviceId !== deviceId) throw new GameError('NOT_HOST');
    return this.runAction(gameId, { role: 'host' }, action, null);
  }

  /** Plays the test players' turns and moves between questions, at a friendly pace. */
  private autopilot(gameId: string) {
    const entry = this.practice.get(gameId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(async () => {
      try {
        const game = await this.prisma.game.findUnique({ where: { id: gameId } });
        if (!game) return;
        const s = game.state as unknown as GameState;
        if (s.phase === 'finished') { this.practice.delete(gameId); return; }
        if (s.paused) return;
        if (s.phase === 'results') {
          entry.timer = setTimeout(() => this.runAction(gameId, { role: 'host' }, { type: 'next_question' }, null).catch(() => {}), 3500);
          return;
        }
        const round = s.rounds[s.rounds.length - 1];
        const turn = round?.turn;
        if (!turn) return;
        const bot = await this.prisma.gameParticipant.findFirst({ where: { gameId, playerId: turn.playerId, isBot: true } });
        if (!bot) return; // the human's turn: they act themselves
        if (turn.awaitingStreakDecision) {
          await this.runAction(gameId, { role: 'host' }, { type: 'end_turn', turnSerial: s.turnSerial }, null);
          return;
        }
        const open = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((r) => !round.claimed[String(r)]);
        const positive = open.filter((r) => r <= 10);
        const roll = Math.random();
        const action: Action = roll < 0.3 || !open.length
          ? { type: 'reject', reason: 'incorrect', turnSerial: s.turnSerial }
          : { type: 'confirm', rank: roll < 0.9 && positive.length ? positive[Math.floor(Math.random() * positive.length)] : open[Math.floor(Math.random() * open.length)], turnSerial: s.turnSerial };
        await this.runAction(gameId, { role: 'host' }, action, null);
      } catch (e) {
        this.log.warn(`practice autopilot: ${String(e)}`);
      }
    }, 1800);
  }

  // ───────────── dev tools: bot players

  async addBots(gameId: string, count: number) {
    const names = ['Lina', 'Omar', 'Sara', 'Yazan', 'Noor', 'Khaled', 'Dana', 'Fadi', 'Rami', 'Hala', 'Zaid', 'Maya', 'Tariq', 'Rana', 'Sami'];
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND);
    if ((game.state as unknown as GameState).phase !== 'lobby') throw new GameError('WRONG_PHASE');
    const taken = new Set((game.state as unknown as GameState).players.map((p) => p.name.toLowerCase()));
    const added: { playerId: string; name: string; token: string }[] = [];
    for (const n of shuffle(names, Math.random)) {
      if (added.length >= count) break;
      if (taken.has(n.toLowerCase())) continue;
      const token = newToken();
      const device = await this.prisma.device.create({ data: { tokenHash: hashToken(token), displayName: `${n} (bot)` } });
      try {
        const { playerId } = await this.join(gameId, device.id, n, true, BOT_COLORS[added.length % BOT_COLORS.length]);
        added.push({ playerId, name: n, token });
      } catch (e) {
        if (e instanceof GameError) break;
        throw e;
      }
    }
    return { added };
  }

  async botAct(gameId: string, playerId: string, action: Action) {
    const p = await this.prisma.gameParticipant.findFirst({ where: { gameId, playerId, isBot: true, removedAt: null } });
    if (!p) throw new GameError('NOT_A_BOT');
    return this.runAction(gameId, { role: 'player', playerId }, action, null);
  }
}
