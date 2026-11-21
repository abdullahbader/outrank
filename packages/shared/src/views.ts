// What each phone may see. The player view never contains the text of an answer that has not been
// claimed, until the question is over (brief §3, §14). The host view contains everything.

import type { Attempt, GameState, Player, Round } from './types.ts';
import { basePoints, RANKS } from './scoring.ts';
import { currentRound, playerAt, positivesLeft } from './engine.ts';

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
}

export function leaderboard(s: GameState): LeaderRow[] {
  const last = currentRound(s);
  const delta = new Map<string, number>();
  if (last) {
    for (const a of s.attempts) {
      if (a.roundIndex !== last.index || a.voided || a.cancelledByStreak || a.outcome !== 'correct') continue;
      delta.set(a.playerId, (delta.get(a.playerId) ?? 0) + a.points);
    }
  }
  const sorted = [...s.players].sort((a, b) => b.score - a.score || s.players.indexOf(a) - s.players.indexOf(b));
  let position = 0;
  let prev: number | null = null;
  return sorted.map((p, i) => {
    if (prev === null || p.score !== prev) position = i + 1;
    prev = p.score;
    return { id: p.id, name: p.name, color: p.color ?? null, score: p.score, position, lastDelta: delta.get(p.id) ?? 0, wild: p.wild, streak: p.streak };
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
        points: showRank || a.outcome !== 'correct' ? a.points : 0,
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
    players: s.players.map((p) => ({ id: p.id, name: p.name, color: p.color ?? null })),
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
  const winners = new Set(s.outcome?.winnerIds ?? []);
  return {
    questionsPlayed: s.rounds.filter((r) => r.finished).length,
    winnerIds: [...winners],
    reason: s.outcome?.reason ?? null,
    players: board.map((row) => {
      const mine = s.attempts.filter((a) => a.playerId === row.id && !a.voided);
      const scored = mine.filter((a) => a.outcome === 'correct' && !a.cancelledByStreak);
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
