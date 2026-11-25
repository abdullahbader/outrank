// The Outrank game engine. Pure: no I/O, no clock, no randomness. The server is the only caller
// during real play; clients never compute points. See docs/05-game-flow.md and docs/06-game-engine.md.

import type {
  Action, Actor, ApplyResult, Attempt, AttemptOutcome, ErrorCode, FinishReason, GameConfig,
  GameEvent, GameState, NextStep, Player, Round, Turn,
} from './types.ts';
import { basePoints, isValidRank, rotate } from './scoring.ts';

export const DEFAULT_CONFIG: GameConfig = {
  targetScore: 100,
  wildMultiplier: 5,
  minPlayers: 2,
  maxPlayers: 16,
  minQuestions: 15,
  answerSeconds: 30,
  streakSeconds: 10,
  nextSeconds: 10,
};

export const MAX_NAME_LENGTH = 20;

export function createGame(opts: { now: number; categories?: string[]; config?: Partial<GameConfig> }): GameState {
  return {
    v: 1,
    config: { ...DEFAULT_CONFIG, ...(opts.config ?? {}) },
    phase: 'lobby',
    paused: false,
    categories: [...(opts.categories ?? [])],
    players: [],
    rotation: [],
    queue: [],
    rounds: [],
    attempts: [],
    cardLog: [],
    endgame: { triggered: false, byAttemptId: null },
    nextStep: null,
    tiedPlayerIds: [],
    outcome: null,
    turnSerial: 0,
    seq: 0,
    createdAt: opts.now,
  };
}

/** Apply one action. Works on a copy: on error the original state is untouched. */
export function apply(state: GameState, actor: Actor, action: Action, now: number): ApplyResult {
  const s: GameState = structuredClone(state);
  const events: GameEvent[] = [];
  const error = handle(s, actor, action, now, events);
  if (error) return { ok: false, error };
  syncTimer(s, now);
  return { ok: true, state: s, events };
}

// ───────────────────────────────────────────── timers

/** What should be counting down right now, if anything. */
function wantedTimer(s: GameState): { kind: 'answer' | 'streak' | 'next'; seconds: number } | null {
  if (!s.config.answerSeconds) return null; // the host chose no timers
  const round = currentRound(s);
  if (s.phase === 'results') return { kind: 'next', seconds: s.config.nextSeconds };
  if (s.phase !== 'question' || !round?.turn) return null;
  if (round.turn.awaitingStreakDecision) return { kind: 'streak', seconds: s.config.streakSeconds };
  return { kind: 'answer', seconds: s.config.answerSeconds };
}

/**
 * Keeps the countdown in step with the game after every action: a new turn, a new attempt, the
 * Streak choice or the results screen starts a fresh countdown; pausing freezes it; resuming
 * carries on with the time that was left.
 */
export function syncTimer(s: GameState, now: number): void {
  const want = wantedTimer(s);
  if (!want) { s.timer = null; return; }
  const key = `${want.kind}:${s.turnSerial}:${s.rounds.length}`;
  if (!s.timer || s.timer.key !== key) {
    const totalMs = want.seconds * 1000;
    s.timer = { key, kind: want.kind, deadline: now + totalMs, remainingMs: null, totalMs };
  }
  if (s.paused && s.timer.deadline !== null) {
    s.timer.remainingMs = Math.max(0, s.timer.deadline - now);
    s.timer.deadline = null;
  } else if (!s.paused && s.timer.deadline === null) {
    s.timer.deadline = now + (s.timer.remainingMs ?? s.timer.totalMs);
    s.timer.remainingMs = null;
  }
}

// ───────────────────────────────────────────── helpers

const isHost = (a: Actor) => a.role === 'host';
const isHostOrSystem = (a: Actor) => a.role === 'host' || a.role === 'system';

export function currentRound(s: GameState): Round | null {
  return s.rounds.length ? s.rounds[s.rounds.length - 1] : null;
}

function player(s: GameState, id: string): Player | undefined {
  return s.players.find((p) => p.id === id);
}

/** Positive answers (ranks 1–10) nobody has claimed yet. The question runs until this is 0. */
export function positivesLeft(r: Round): number {
  let n = 0;
  for (let rank = 1; rank <= 10; rank++) if (!r.claimed[String(rank)]) n++;
  return n;
}

/** Whose turn a running turn index points at: turns keep cycling through the participants. */
export const playerAt = (r: Round, turnIndex: number) => r.participants[turnIndex % r.participants.length];

function newTurn(playerId: string): Turn {
  return { playerId, attemptNo: 1, awaitingStreakDecision: false, firstAttemptId: null };
}

function nextId(s: GameState, prefix: string): string {
  s.seq += 1;
  return `${prefix}${s.seq}`;
}

/** Scores are always derived from the answers — never stored independently. */
export function recomputeScores(s: GameState): void {
  for (const p of s.players) p.score = 0;
  const pts = effectivePoints(s);
  for (const a of s.attempts) {
    const v = pts.get(a.id);
    if (v === undefined) continue;
    const p = player(s, a.playerId);
    if (p) p.score += v;
  }
}

/** Owner's rule (2026-11-22): the same player claiming both rank 11 and rank 12 in one question. */
export const COMBO_POINTS = 20;

/**
 * What each counting answer is worth. Normally its own points; but when one player holds both
 * rank 11 and rank 12 in the same question (any turns), those two together are worth a fixed +20
 * instead of −23 (Wild does not multiply it): the earlier of the two counts 0, the later +20.
 */
export function effectivePoints(s: GameState): Map<string, number> {
  const out = new Map<string, number>();
  const pairs = new Map<string, Attempt[]>();
  for (const a of s.attempts) {
    if (a.voided || a.cancelledByStreak || a.outcome !== 'correct') continue;
    out.set(a.id, a.points);
    if (a.rank === 11 || a.rank === 12) {
      const key = `${a.roundIndex}:${a.playerId}`;
      pairs.set(key, [...(pairs.get(key) ?? []), a]);
    }
  }
  for (const list of pairs.values()) {
    if (list.some((a) => a.rank === 11) && list.some((a) => a.rank === 12)) {
      const [first, second] = [...list].sort((x, y) => s.attempts.indexOf(x) - s.attempts.indexOf(y));
      out.set(first.id, 0);
      out.set(second.id, COMBO_POINTS);
    }
  }
  return out;
}

function checkTrigger(s: GameState, attemptId: string | null, events: GameEvent[]): void {
  if (s.endgame.triggered) return;
  const reached = s.players.filter((p) => p.score >= s.config.targetScore);
  if (!reached.length) return;
  s.endgame = { triggered: true, byAttemptId: attemptId };
  events.push({ type: 'target_reached', playerIds: reached.map((p) => p.id), target: s.config.targetScore });
}

function topOf(s: GameState, ids: string[]): string[] {
  const ps = ids.map((id) => player(s, id)).filter((p): p is Player => !!p);
  if (!ps.length) return [];
  const best = Math.max(...ps.map((p) => p.score));
  return ps.filter((p) => p.score === best).map((p) => p.id);
}

interface Decision { nextStep: NextStep; tied: string[]; winnerIds: string[]; reason: FinishReason | null }

/** What happens after the current (finished) question. Deterministic — called at the end of a
 *  question (for display) and again on Continue (to act). */
export function decide(s: GameState): Decision {
  const round = currentRound(s);
  const all = s.players.map((p) => p.id);
  const contenders = round?.isTiebreak ? round.participants : s.endgame.triggered ? all : null;
  const hasQuestions = s.queue.length > 0;

  if (!contenders) {
    if (hasQuestions) return { nextStep: 'next_question', tied: [], winnerIds: [], reason: null };
    const top = topOf(s, all);
    return { nextStep: 'finished', tied: [], winnerIds: top, reason: top.length > 1 ? 'shared_win' : 'out_of_questions' };
  }
  const top = topOf(s, contenders);
  if (top.length === 1) return { nextStep: 'finished', tied: [], winnerIds: top, reason: 'winner' };
  if (hasQuestions) return { nextStep: 'tiebreak', tied: top, winnerIds: [], reason: null };
  return { nextStep: 'finished', tied: top, winnerIds: top, reason: 'shared_win' };
}

function startRound(s: GameState, isTiebreak: boolean, participants: string[], now: number, events: GameEvent[]): void {
  const questionId = s.queue.shift()!;
  const round: Round = {
    index: s.rounds.length,
    questionId,
    isTiebreak,
    participants: [...participants],
    turnIndex: 0,
    turn: newTurn(participants[0]),
    claimed: {},
    rotationBefore: [...s.rotation],
    finished: false,
    startedAt: now,
  };
  s.rounds.push(round);
  s.phase = 'question';
  s.nextStep = null;
  s.tiedPlayerIds = [];
  s.turnSerial += 1;
  events.push({ type: 'question_started', roundIndex: round.index, questionId, isTiebreak, participants: round.participants });
  events.push({ type: 'turn_started', roundIndex: round.index, playerId: participants[0], attemptNo: 1 });
}

function finishRound(s: GameState, events: GameEvent[]): void {
  const round = currentRound(s)!;
  round.finished = true;
  round.turn = null;
  s.turnSerial += 1;
  s.rotation = rotate(round.rotationBefore);
  s.phase = 'results';
  const d = decide(s);
  s.nextStep = d.nextStep;
  s.tiedPlayerIds = d.tied;
  events.push({ type: 'question_finished', roundIndex: round.index, nextStep: d.nextStep, tied: d.tied, nextStarter: s.rotation[0] });
}

function endTurn(s: GameState, events: GameEvent[]): void {
  const round = currentRound(s)!;
  round.turnIndex += 1;
  // The question keeps going round the table until every positive answer is claimed
  // (or the host ends it). Ranks 11 and 12 may stay unclaimed.
  if (positivesLeft(round) === 0) {
    finishRound(s, events);
    return;
  }
  const pid = playerAt(round, round.turnIndex);
  round.turn = newTurn(pid);
  s.turnSerial += 1;
  events.push({ type: 'turn_started', roundIndex: round.index, playerId: pid, attemptNo: 1 });
}

function record(s: GameState, round: Round, outcome: AttemptOutcome, rank: number | null, now: number): Attempt {
  const turn = round.turn!;
  const p = player(s, turn.playerId)!;
  const wildArmed = p.wild === 'armed';
  const correct = outcome === 'correct';
  const multiplier = correct && wildArmed ? s.config.wildMultiplier : 1;
  const base = correct && rank !== null ? basePoints(rank) : 0;
  const attempt: Attempt = {
    id: nextId(s, 'att'),
    roundIndex: round.index,
    turnIndex: round.turnIndex,
    playerId: p.id,
    attemptNo: turn.attemptNo,
    rank: correct ? rank : null,
    outcome,
    basePoints: base,
    multiplier,
    points: base * multiplier,
    usedWild: false,
    usedStreak: turn.attemptNo === 2,
    cancelledByStreak: false,
    voided: false,
    at: now,
  };
  if (wildArmed) {
    if (outcome === 'skipped' || outcome === 'passed') {
      // No answer was given (skipped by the host, or the player passed): the card goes back.
      p.wild = 'available';
      removeCardLog(s, p.id, 'wild', null);
    } else {
      // Switched on for this answer: used up whether or not the answer was right.
      p.wild = 'used';
      attempt.usedWild = true;
      const entry = [...s.cardLog].reverse().find((c) => c.playerId === p.id && c.card === 'wild' && c.attemptId === null);
      if (entry) entry.attemptId = attempt.id;
    }
  }
  if (turn.attemptNo === 2) {
    const entry = [...s.cardLog].reverse().find((c) => c.playerId === p.id && c.card === 'streak' && c.attemptId === null);
    if (entry) entry.attemptId = attempt.id;
  }
  s.attempts.push(attempt);
  if (correct && rank !== null) round.claimed[String(rank)] = attempt.id;
  return attempt;
}

function removeCardLog(s: GameState, playerId: string, card: 'wild' | 'streak', attemptId: string | null): void {
  for (let i = s.cardLog.length - 1; i >= 0; i--) {
    const c = s.cardLog[i];
    if (c.playerId === playerId && c.card === card && c.attemptId === attemptId) {
      s.cardLog.splice(i, 1);
      return;
    }
  }
}

function attemptEvent(s: GameState, a: Attempt): GameEvent {
  return {
    type: a.outcome === 'correct' ? 'answer_confirmed' : a.outcome === 'skipped' ? 'turn_skipped' : a.outcome === 'passed' ? 'turn_passed' : a.outcome === 'timed_out' ? 'time_up' : 'answer_rejected',
    attemptId: a.id,
    roundIndex: a.roundIndex,
    playerId: a.playerId,
    attemptNo: a.attemptNo,
    outcome: a.outcome,
    rank: a.rank,
    basePoints: a.basePoints,
    multiplier: a.multiplier,
    points: a.points,
    usedWild: a.usedWild,
    total: player(s, a.playerId)?.score ?? 0,
  };
}

/** A Streak second attempt that did not succeed cancels the first answer's points. */
function failStreak(s: GameState, round: Round, events: GameEvent[]): void {
  const firstId = round.turn?.firstAttemptId;
  const first = s.attempts.find((a) => a.id === firstId);
  if (!first) return;
  first.cancelledByStreak = true;
  recomputeScores(s);
  events.push({ type: 'streak_failed', playerId: first.playerId, cancelledAttemptId: first.id, lostPoints: first.points, total: player(s, first.playerId)?.score ?? 0 });
}

// ───────────────────────────────────────────── the action handler

function handle(s: GameState, actor: Actor, action: Action, now: number, events: GameEvent[]): ErrorCode | null {
  if (s.phase === 'finished') return 'GAME_FINISHED';

  switch (action.type) {
    // ── lobby
    case 'join': {
      const hostAdds = isHost(actor) && !!s.config.hostOnly; // one-phone game: the host adds players by name
      if (!(hostAdds || actor.role === 'system' || (actor.role === 'player' && actor.playerId === action.playerId))) return 'NOT_PLAYER';
      if (s.phase !== 'lobby') return 'WRONG_PHASE';
      const name = (action.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > MAX_NAME_LENGTH) return 'NAME_INVALID';
      if (player(s, action.playerId)) return 'ALREADY_JOINED';
      if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'NAME_TAKEN';
      if (s.players.length >= s.config.maxPlayers) return 'GAME_FULL';
      const color = typeof action.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(action.color) ? action.color : undefined;
      const emoji = typeof action.emoji === 'string' && action.emoji.length > 0 && action.emoji.length <= 16 ? action.emoji : undefined;
      s.players.push({ id: action.playerId, name, ...(color ? { color } : {}), ...(emoji ? { emoji } : {}), score: 0, wild: 'available', streak: 'available' });
      events.push({ type: 'player_joined', playerId: action.playerId, name });
      return null;
    }
    case 'leave': {
      if (actor.role !== 'player') return 'NOT_PLAYER';
      if (s.phase !== 'lobby') return 'WRONG_PHASE';
      if (!player(s, actor.playerId)) return 'UNKNOWN_PLAYER';
      s.players = s.players.filter((p) => p.id !== actor.playerId);
      events.push({ type: 'player_left', playerId: actor.playerId });
      return null;
    }
    case 'remove_player': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'lobby') return 'WRONG_PHASE';
      if (!player(s, action.playerId)) return 'UNKNOWN_PLAYER';
      s.players = s.players.filter((p) => p.id !== action.playerId);
      events.push({ type: 'player_removed', playerId: action.playerId });
      return null;
    }
    case 'set_categories': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'lobby') return 'WRONG_PHASE';
      const cats = [...new Set(action.categories ?? [])];
      if (!cats.length) return 'NO_CATEGORIES';
      s.categories = cats;
      events.push({ type: 'categories_set', categories: cats });
      return null;
    }
    case 'start': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'lobby') return 'WRONG_PHASE';
      if (!s.categories.length) return 'NO_CATEGORIES';
      if (s.players.length < s.config.minPlayers) return 'NOT_ENOUGH_PLAYERS';
      const ids = [...new Set(action.questionIds ?? [])];
      if (ids.length < s.config.minQuestions || ids.length !== (action.questionIds ?? []).length) return 'NOT_ENOUGH_QUESTIONS';
      s.rotation = s.players.map((p) => p.id); // fixed from now on
      s.queue = ids;
      events.push({ type: 'game_started', players: s.rotation, questionCount: ids.length });
      startRound(s, false, s.rotation, now, events);
      return null;
    }

    // ── pause / end
    case 'pause': {
      if (!isHostOrSystem(actor)) return 'NOT_HOST';
      if (s.phase === 'lobby') return 'WRONG_PHASE';
      if (s.paused) return null; // already paused: harmless repeat
      s.paused = true;
      events.push({ type: 'paused', by: actor.role });
      return null;
    }
    case 'resume': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (!s.paused) return 'NOT_PAUSED';
      s.paused = false;
      events.push({ type: 'resumed' });
      return null;
    }
    case 'end_game': {
      if (!isHost(actor)) return 'NOT_HOST';
      const round = currentRound(s);
      if (round && !round.finished) { round.turn = null; }
      const winners = s.phase === 'lobby' ? [] : topOf(s, s.players.map((p) => p.id));
      s.phase = 'finished';
      s.paused = false;
      s.turnSerial += 1;
      s.outcome = { winnerIds: winners, reason: 'ended_by_host' };
      events.push({ type: 'game_finished', winnerIds: winners, reason: 'ended_by_host' });
      return null;
    }
  }

  // Everything below is play.
  if (s.phase === 'lobby') return 'WRONG_PHASE';
  if (s.paused) return 'PAUSED';
  const round = currentRound(s)!;

  switch (action.type) {
    case 'confirm':
    case 'reject':
    case 'skip_turn': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'question' || !round.turn) return 'WRONG_PHASE';
      if (action.turnSerial !== s.turnSerial || round.turn.awaitingStreakDecision) return 'STALE_TURN';
      const attemptNo = round.turn.attemptNo;

      if (action.type === 'confirm') {
        if (!isValidRank(action.rank)) return 'INVALID_RANK';
        if (round.claimed[String(action.rank)]) return 'ALREADY_CLAIMED';
        const a = record(s, round, 'correct', action.rank, now);
        recomputeScores(s);
        events.push(attemptEvent(s, a));
        if ((a.rank === 11 || a.rank === 12) && effectivePoints(s).get(a.id) === COMBO_POINTS) {
          events.push({ type: 'combo_11_12', playerId: a.playerId, points: COMBO_POINTS, total: player(s, a.playerId)?.score ?? 0 });
        }
        checkTrigger(s, a.id, events);
        const p = player(s, a.playerId)!;
        if (attemptNo === 1 && p.streak === 'available' && positivesLeft(round) > 0) {
          round.turn.awaitingStreakDecision = true;
          round.turn.firstAttemptId = a.id;
          events.push({ type: 'streak_offered', playerId: p.id });
          return null;
        }
        endTurn(s, events);
        return null;
      }

      const outcome: AttemptOutcome = action.type === 'skip_turn' ? 'skipped' : action.reason === 'already_claimed' ? 'already_claimed' : action.reason === 'pass' ? 'passed' : 'incorrect';
      if (action.type === 'reject' && action.reason !== 'incorrect' && action.reason !== 'already_claimed' && action.reason !== 'pass') return 'UNKNOWN_ACTION';
      // "Already claimed" only makes sense once something has been claimed in this question.
      if (outcome === 'already_claimed' && Object.keys(round.claimed).length === 0) return 'NOTHING_CLAIMED';
      const a = record(s, round, outcome, null, now);
      recomputeScores(s);
      events.push(attemptEvent(s, a));
      if (attemptNo === 2) failStreak(s, round, events);
      endTurn(s, events);
      return null;
    }

    case 'end_turn': {
      if (s.phase !== 'question' || !round.turn) return 'WRONG_PHASE';
      const mine = actor.role === 'player' && actor.playerId === round.turn.playerId;
      if (!isHost(actor) && !mine) return actor.role === 'player' ? 'NOT_YOUR_TURN' : 'NOT_HOST';
      if (action.turnSerial !== s.turnSerial || !round.turn.awaitingStreakDecision) return 'STALE_TURN';
      events.push({ type: 'streak_declined', playerId: round.turn.playerId, by: actor.role });
      endTurn(s, events);
      return null;
    }

    case 'activate_wild':
    case 'activate_streak': {
      // The host never uses a player's card, except in a one-phone game where the host plays the
      // card for whoever's turn it is (the players have no phones of their own).
      const forTurn = isHost(actor) && !!s.config.hostOnly;
      if (actor.role !== 'player' && !forTurn) return 'NOT_PLAYER';
      if (s.phase !== 'question' || !round.turn) return 'CARD_NOT_ALLOWED_NOW';
      const p = player(s, actor.role === 'player' ? actor.playerId : round.turn.playerId);
      if (!p) return 'UNKNOWN_PLAYER';
      if (round.turn.playerId !== p.id) return 'NOT_YOUR_TURN';
      if (action.type === 'activate_wild') {
        if (p.wild !== 'available') return 'CARD_USED';
        if (action.turnSerial !== s.turnSerial) return 'STALE_TURN';
        if (round.turn.awaitingStreakDecision) return 'CARD_NOT_ALLOWED_NOW';
        p.wild = 'armed';
        s.cardLog.push({ playerId: p.id, card: 'wild', roundIndex: round.index, attemptId: null, at: now });
        events.push({ type: 'card_activated', card: 'wild', playerId: p.id, attemptNo: round.turn.attemptNo });
        return null;
      }
      if (p.streak !== 'available') return 'CARD_USED';
      if (action.turnSerial !== s.turnSerial) return 'STALE_TURN';
      if (!round.turn.awaitingStreakDecision) return 'CARD_NOT_ALLOWED_NOW';
      p.streak = 'used';
      round.turn.awaitingStreakDecision = false;
      round.turn.attemptNo = 2;
      round.turn.typed = null;
      s.turnSerial += 1;
      s.cardLog.push({ playerId: p.id, card: 'streak', roundIndex: round.index, attemptId: null, at: now });
      events.push({ type: 'card_activated', card: 'streak', playerId: p.id });
      events.push({ type: 'turn_started', roundIndex: round.index, playerId: p.id, attemptNo: 2 });
      return null;
    }

    case 'void_attempt':
      return voidAttempt(s, actor, action.attemptId, !!action.replayTurn, events);

    case 'timeout': {
      // Sent by the server's clock when a countdown runs out. Never accepted early.
      if (actor.role !== 'system') return 'NOT_HOST';
      const tm = s.timer;
      if (!tm || tm.deadline === null) return 'NO_TIMER';
      if (action.turnSerial !== s.turnSerial) return 'STALE_TURN';
      if (now < tm.deadline - 250) return 'TOO_EARLY';
      events.push({ type: 'timer_expired', kind: tm.kind });
      if (tm.kind === 'next') return handle(s, { role: 'host' }, { type: 'next_question' }, now, events);
      if (s.phase !== 'question' || !round.turn) return 'WRONG_PHASE';
      if (tm.kind === 'streak') {
        if (!round.turn.awaitingStreakDecision) return 'STALE_TURN';
        events.push({ type: 'streak_declined', playerId: round.turn.playerId, by: 'timer' });
        endTurn(s, events);
        return null;
      }
      if (round.turn.awaitingStreakDecision) return 'STALE_TURN';
      // Time's up: counts like a wrong answer — no points, turn over.
      const attemptNo = round.turn.attemptNo;
      const a = record(s, round, 'timed_out', null, now);
      recomputeScores(s);
      events.push(attemptEvent(s, a));
      if (attemptNo === 2) failStreak(s, round, events);
      endTurn(s, events);
      return null;
    }

    case 'submit_answer': {
      // The player types the answer they are giving; the host still decides. Can be changed until ruled.
      if (actor.role !== 'player') return 'NOT_PLAYER';
      if (s.phase !== 'question' || !round.turn) return 'WRONG_PHASE';
      if (round.turn.playerId !== actor.playerId) return 'NOT_YOUR_TURN';
      if (action.turnSerial !== s.turnSerial || round.turn.awaitingStreakDecision) return 'STALE_TURN';
      const text = String(action.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 80) return 'ANSWER_INVALID';
      round.turn.typed = text;
      events.push({ type: 'answer_submitted', playerId: actor.playerId, text });
      return null;
    }

    case 'end_question': {
      // The host can end (skip) the current question at any time.
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'question' || !round.turn) return 'WRONG_PHASE';
      const t = round.turn;
      const p = player(s, t.playerId);
      if (p && p.wild === 'armed') { p.wild = 'available'; removeCardLog(s, p.id, 'wild', null); }
      if (p && t.attemptNo === 2) {
        // Streak was switched on but the extra answer never came: the card goes back, the first answer stands.
        p.streak = 'available';
        removeCardLog(s, p.id, 'streak', null);
      }
      events.push({ type: 'question_ended_by_host', roundIndex: round.index });
      finishRound(s, events);
      return null;
    }

    case 'next_question': {
      if (!isHost(actor)) return 'NOT_HOST';
      if (s.phase !== 'results') return 'WRONG_PHASE';
      const d = decide(s);
      if (d.nextStep === 'finished') {
        s.phase = 'finished';
        s.outcome = { winnerIds: d.winnerIds, reason: d.reason ?? 'winner' };
        s.turnSerial += 1;
        events.push({ type: 'game_finished', winnerIds: d.winnerIds, reason: s.outcome.reason });
        return null;
      }
      const participants = d.nextStep === 'tiebreak' ? s.rotation.filter((id) => d.tied.includes(id)) : s.rotation;
      startRound(s, d.nextStep === 'tiebreak', participants, now, events);
      return null;
    }
  }
  return 'UNKNOWN_ACTION';
}

// ───────────────────────────────────────────── host corrections

function voidAttempt(s: GameState, actor: Actor, attemptId: string, replayTurn: boolean, events: GameEvent[]): ErrorCode | null {
  if (!isHost(actor)) return 'NOT_HOST';
  if (s.phase !== 'question' && s.phase !== 'results') return 'WRONG_PHASE';
  const round = currentRound(s)!;
  const a = s.attempts.find((x) => x.id === attemptId);
  if (!a) return 'UNKNOWN_ATTEMPT';
  if (a.roundIndex !== round.index) return 'NOT_CURRENT_QUESTION';
  if (a.voided) return 'ALREADY_VOIDED';

  const roundAttempts = s.attempts.filter((x) => x.roundIndex === round.index && !x.voided);
  const isLatest = roundAttempts[roundAttempts.length - 1]?.id === a.id;
  const inCurrentTurn = !!round.turn && round.turnIndex === a.turnIndex; // turn still running (Streak pending)
  const p = player(s, a.playerId)!;

  if (replayTurn && !inCurrentTurn) {
    const previousTurn = a.turnIndex === round.turnIndex - 1;
    if (!isLatest || !previousTurn) return 'CANNOT_REPLAY';
  }

  // 1. Undo the answer itself.
  a.voided = true;
  if (a.rank !== null && round.claimed[String(a.rank)] === a.id) delete round.claimed[String(a.rank)];
  if (a.usedWild && p.wild === 'used') {
    p.wild = 'available';
    removeCardLog(s, p.id, 'wild', a.id);
  }
  if (a.usedStreak) {
    const first = s.attempts.find((x) => x.roundIndex === a.roundIndex && x.turnIndex === a.turnIndex && x.attemptNo === 1 && x.playerId === a.playerId);
    if (first) first.cancelledByStreak = false;
    if (p.streak === 'used') {
      p.streak = 'available';
      removeCardLog(s, p.id, 'streak', a.id);
    }
  }
  recomputeScores(s);
  if (s.endgame.triggered && s.endgame.byAttemptId === a.id && !s.players.some((pl) => pl.score >= s.config.targetScore)) {
    s.endgame = { triggered: false, byAttemptId: null };
    events.push({ type: 'target_unreached' });
  }
  checkTrigger(s, null, events);

  let replayed = false;
  if (inCurrentTurn) {
    // The running turn's first answer was wrong: that player answers again from the start.
    const t = round.turn!;
    if (t.attemptNo === 2 && p.streak === 'used') {
      p.streak = 'available';
      removeCardLog(s, p.id, 'streak', null);
    }
    if (p.wild === 'armed') { p.wild = 'available'; removeCardLog(s, p.id, 'wild', null); }
    round.turn = newTurn(p.id);
    s.turnSerial += 1;
    replayed = true;
  } else if (replayTurn) {
    if (round.finished) {
      round.finished = false;
      s.rotation = [...round.rotationBefore];
      s.phase = 'question';
      s.nextStep = null;
      s.tiedPlayerIds = [];
    } else if (round.turn) {
      const waiting = player(s, round.turn.playerId);
      if (waiting && waiting.wild === 'armed') { waiting.wild = 'available'; removeCardLog(s, waiting.id, 'wild', null); }
    }
    round.turnIndex = a.turnIndex;
    if (a.attemptNo === 2) {
      const first = s.attempts.find((x) => x.roundIndex === a.roundIndex && x.turnIndex === a.turnIndex && x.attemptNo === 1 && x.playerId === a.playerId && !x.voided);
      p.streak = 'used';
      s.cardLog.push({ playerId: p.id, card: 'streak', roundIndex: round.index, attemptId: null, at: a.at });
      round.turn = { playerId: p.id, attemptNo: 2, awaitingStreakDecision: false, firstAttemptId: first?.id ?? null };
    } else {
      round.turn = newTurn(p.id);
    }
    s.turnSerial += 1;
    replayed = true;
  } else if (round.finished) {
    const d = decide(s);
    s.nextStep = d.nextStep;
    s.tiedPlayerIds = d.tied;
  }

  events.push({ type: 'attempt_voided', attemptId: a.id, playerId: a.playerId, replayed, total: p.score });
  if (replayed) events.push({ type: 'turn_started', roundIndex: round.index, playerId: p.id, attemptNo: round.turn!.attemptNo, replay: true });
  return null;
}
