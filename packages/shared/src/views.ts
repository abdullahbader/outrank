// What each phone may see. The player view never contains the text of an answer that has not been
// claimed, until the question is over (brief §3, §14). The host view contains everything.

import type { Attempt, GameState, Player, Round } from './types.ts';
import { basePoints, RANKS } from './scoring.ts';
import { currentRound, effectivePoints, playerAt, positivesLeft } from './engine.ts';

export interface Localized { en: string; ar?: string }

export interface QuestionContent {
  id: string;
  categoryId: string;
  title: Localized;
  difficulty: number;
  rankingBasis?: Localized;
  asOf?: string;
  explanation?: Localized;
  answers: { rank: number; text: Localized; aliases?: string[]; valueNote?: string }[];
}

export type Viewer = { role: 'host' } | { role: 'player'; playerId: string };

export interface LeaderRow {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  score: number;
  position: number;      // 1-based, equal scores share a position
  lastDelta: number;     // points gained/lost in the most recent question
  wild: Player['wild'];
  streak: Player['streak'];
}

export interface AnswerSlot {
  rank: number;
  points: number;
  text: Localized | null;          // null = hidden from this viewer
  aliases?: string[];              // host only
  valueNote?: string | null;
  claimedBy: string | null;        // player id
  attemptId: string | null;
}

export interface AttemptView {
  id: string;
  playerId: string;
  attemptNo: 1 | 2;
  outcome: Attempt['outcome'];
  rank: number | null;
  text: Localized | null;
  basePoints: number;
  multiplier: number;
  points: number;
  usedWild: boolean;
  usedStreak: boolean;
  cancelledByStreak: boolean;
  voided: boolean;
  combo: boolean;          // part of an 11 + 12 combo (worth +20 together)
}

/** Loose comparison for typed answers: case, accents, punctuation, Arabic letter forms, leading "the"/"ال". */
export function normalizeAnswer(v: string): string {
  return v
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u0652\u0640]/g, '')            // Arabic diacritics and tatweel
    .replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/^(the|ال)\s*/u, '')
    .replace(/\s(of|the)\s/g, ' ')
    .trim();
}

/** The answer (rank) a typed text most likely matches, for the host's one-tap confirm. */
export function suggestRank(q: QuestionContent | undefined, typed: string | null | undefined): number | null {
  if (!q || !typed) return null;
  const t = normalizeAnswer(typed);
  if (!t) return null;
  let best: { rank: number; score: number } | null = null;
  for (const a of q.answers) {
    for (const name of [a.text.en, a.text.ar, ...(a.aliases ?? [])].filter(Boolean) as string[]) {
      const n = normalizeAnswer(name);
      if (!n) continue;
      const score = n === t ? 3 : (n.length >= 4 && t.length >= 4 && (n.includes(t) || t.includes(n))) ? 1 : 0;
      if (score && (!best || score > best.score)) best = { rank: a.rank, score };
    }
  }
  return best?.rank ?? null;
}

export function leaderboard(s: GameState): LeaderRow[] {
  const last = currentRound(s);
  const delta = new Map<string, number>();
  const pts = effectivePoints(s);
  if (last) {
    for (const a of s.attempts) {
      const v = pts.get(a.id);
      if (a.roundIndex !== last.index || v === undefined) continue;
      delta.set(a.playerId, (delta.get(a.playerId) ?? 0) + v);
    }
  }
  const sorted = [...s.players].sort((a, b) => b.score - a.score || s.players.indexOf(a) - s.players.indexOf(b));
  let position = 0;
  let prev: number | null = null;
  return sorted.map((p, i) => {
    if (prev === null || p.score !== prev) position = i + 1;
    prev = p.score;
    return { id: p.id, name: p.name, color: p.color ?? null, emoji: p.emoji ?? null, score: p.score, position, lastDelta: delta.get(p.id) ?? 0, wild: p.wild, streak: p.streak };
  });
}

function slotsFor(round: Round, q: QuestionContent | undefined, s: GameState, viewer: Viewer): AnswerSlot[] {
  const reveal = viewer.role === 'host' || round.finished;
  return RANKS.map((rank) => {
    const attemptId = round.claimed[String(rank)] ?? null;
    const claimedBy = attemptId ? s.attempts.find((a) => a.id === attemptId)?.playerId ?? null : null;
    const ans = q?.answers.find((a) => a.rank === rank);
    const visible = reveal || !!attemptId;
    const slot: AnswerSlot = {
      rank,
      points: basePoints(rank),
      text: visible && ans ? ans.text : null,
      valueNote: visible ? ans?.valueNote ?? null : null,
      claimedBy,
      attemptId,
    };
    if (viewer.role === 'host') slot.aliases = ans?.aliases ?? [];
    return slot;
  });
}

function attemptsFor(round: Round, q: QuestionContent | undefined, s: GameState, viewer: Viewer): AttemptView[] {
  const reveal = viewer.role === 'host' || round.finished;
  const pts = effectivePoints(s);
  const combo = new Set(s.attempts.filter((a) => a.roundIndex === round.index && a.outcome === 'correct' && (a.rank === 11 || a.rank === 12) && pts.get(a.id) !== undefined && pts.get(a.id) !== a.points).map((a) => a.id));
  return s.attempts
    .filter((a) => a.roundIndex === round.index)
    .map((a) => {
      // A voided correct answer frees its rank again — players must not learn what it was.
      const showRank = a.rank !== null && (reveal || (!a.voided && round.claimed[String(a.rank)] === a.id));
      const ans = showRank ? q?.answers.find((x) => x.rank === a.rank) : undefined;
      return {
        id: a.id,
        playerId: a.playerId,
        attemptNo: a.attemptNo,
        outcome: a.outcome,
        rank: showRank ? a.rank : null,
        text: ans ? ans.text : null,
        basePoints: showRank || a.outcome !== 'correct' ? a.basePoints : 0,
        multiplier: a.multiplier,
        points: showRank || a.outcome !== 'correct' ? (pts.get(a.id) ?? a.points) : 0,
        combo: showRank && combo.has(a.id),
        usedWild: a.usedWild,
        usedStreak: a.usedStreak,
        cancelledByStreak: a.cancelledByStreak,
        voided: a.voided,
      };
    });
}

export function buildView(s: GameState, questions: Record<string, QuestionContent>, viewer: Viewer) {
  const round = currentRound(s);
  const q = round ? questions[round.questionId] : undefined;
  const me = viewer.role === 'player' ? s.players.find((p) => p.id === viewer.playerId) ?? null : null;
  const turn = round?.turn ?? null;
  const myTurn = !!me && !!turn && turn.playerId === me.id && s.phase === 'question' && !s.paused;

  const roundView = round && q
    ? {
        index: round.index,
        number: round.index + 1,
        isTiebreak: round.isTiebreak,
        questionId: round.questionId,
        categoryId: q.categoryId,
        title: q.title,
        rankingBasis: q.rankingBasis ?? null,
        asOf: q.asOf ?? null,
        explanation: round.finished || viewer.role === 'host' ? q.explanation ?? null : null,
        participants: round.participants,
        turnIndex: round.turnIndex,
        turn,
        finished: round.finished,
        claimedCount: Object.keys(round.claimed).length,
        suggestedRank: viewer.role === 'host' ? suggestRank(q, round.turn?.typed) : null,
        positivesLeft: positivesLeft(round),
        nextPlayerId: round.turn ? playerAt(round, round.turnIndex + 1) : null,
        lap: Math.floor(round.turnIndex / round.participants.length) + 1,
        slots: slotsFor(round, q, s, viewer),
        attempts: attemptsFor(round, q, s, viewer),
      }
    : null;

  return {
    role: viewer.role,
    phase: s.phase,
    paused: s.paused,
    categories: s.categories,
    targetScore: s.config.targetScore,
    wildMultiplier: s.config.wildMultiplier,
    turnSerial: s.turnSerial,
    players: s.players.map((p) => ({ id: p.id, name: p.name, color: p.color ?? null, emoji: p.emoji ?? null })),
    leaderboard: leaderboard(s),
    rotation: s.rotation,
    questionsPlayed: s.rounds.filter((r) => r.finished).length,
    questionsLeft: s.queue.length,
    round: roundView,
    endgame: { triggered: s.endgame.triggered },
    nextStep: s.nextStep,
    tiedPlayerIds: s.tiedPlayerIds,
    nextStarter: s.phase === 'results' ? (s.nextStep === 'tiebreak' ? s.rotation.find((id) => s.tiedPlayerIds.includes(id)) ?? null : s.rotation[0] ?? null) : null,
    cardLog: s.cardLog.map((c) => ({ playerId: c.playerId, card: c.card, roundIndex: c.roundIndex, at: c.at })),
    outcome: s.outcome,
    timer: s.timer ? { kind: s.timer.kind, deadline: s.timer.deadline, remainingMs: s.timer.remainingMs, totalMs: s.timer.totalMs } : null,
    answerSeconds: s.config.answerSeconds,
    me: me
      ? {
          playerId: me.id,
          isMyTurn: myTurn,
          wild: me.wild,
          streak: me.streak,
          canActivateWild: myTurn && me.wild === 'available' && !turn!.awaitingStreakDecision,
          canActivateStreak: myTurn && me.streak === 'available' && turn!.awaitingStreakDecision,
          canEndTurn: myTurn && turn!.awaitingStreakDecision,
        }
      : null,
    summary: s.phase === 'finished' ? finalSummary(s) : null,
  };
}

export type GameView = ReturnType<typeof buildView>;

/** Per-player numbers for the Final Results screen and profile stats. */
export function finalSummary(s: GameState) {
  const board = leaderboard(s);
  const pts = effectivePoints(s);
  const winners = new Set(s.outcome?.winnerIds ?? []);
  return {
    questionsPlayed: s.rounds.filter((r) => r.finished).length,
    winnerIds: [...winners],
    reason: s.outcome?.reason ?? null,
    players: board.map((row) => {
      const mine = s.attempts.filter((a) => a.playerId === row.id && !a.voided);
      const scored = mine.filter((a) => a.outcome === 'correct' && !a.cancelledByStreak).map((a) => ({ ...a, points: pts.get(a.id) ?? a.points }));
      return {
        id: row.id,
        name: row.name,
        position: row.position,
        score: row.score,
        won: winners.has(row.id),
        answersClaimed: mine.filter((a) => a.outcome === 'correct').length,
        pointsGained: scored.filter((a) => a.points > 0).reduce((n, a) => n + a.points, 0),
        pointsLost: -scored.filter((a) => a.points < 0).reduce((n, a) => n + a.points, 0)
          + mine.filter((a) => a.cancelledByStreak && a.points > 0).reduce((n, a) => n + a.points, 0),
        cardsUsed: s.cardLog.filter((c) => c.playerId === row.id).map((c) => c.card),
      };
    }),
  };
}
