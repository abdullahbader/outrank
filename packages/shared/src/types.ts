// Engine types. Plain TypeScript (no enums) so Node can run it directly.

export type WildState = 'available' | 'armed' | 'used';
export type StreakState = 'available' | 'used';

export interface GameConfig {
  targetScore: number;      // 100
  wildMultiplier: number;   // 5
  minPlayers: number;       // 2
  maxPlayers: number;       // 16
  minQuestions: number;     // questions needed to start
  answerSeconds: number;    // time to answer on a turn; 0 = no timers at all
  streakSeconds: number;    // time to decide on Streak
  nextSeconds: number;      // results screen before the next question starts
}

export interface Player {
  id: string;
  name: string;
  color?: string;           // avatar colour the player picked (display only)
  emoji?: string;           // profile picture emoji (display only)
  score: number;            // derived from attempts — never set directly
  wild: WildState;
  streak: StreakState;
}

export type AttemptOutcome = 'correct' | 'incorrect' | 'already_claimed' | 'passed' | 'skipped' | 'timed_out';

export interface Attempt {
  id: string;
  roundIndex: number;
  turnIndex: number;
  playerId: string;
  attemptNo: 1 | 2;
  rank: number | null;
  outcome: AttemptOutcome;
  basePoints: number;
  multiplier: number;       // 1, or the Wild multiplier
  points: number;           // basePoints × multiplier (0 when not correct)
  usedWild: boolean;        // Wild was consumed on this attempt
  usedStreak: boolean;      // this was the Streak second attempt
  cancelledByStreak: boolean; // first-attempt points cancelled because the Streak attempt failed
  voided: boolean;
  at: number;
}

export interface Turn {
  playerId: string;
  attemptNo: 1 | 2;
  awaitingStreakDecision: boolean;
  firstAttemptId: string | null;
  /** What the player typed for this attempt (the host still rules on it). */
  typed?: string | null;
}

export interface Round {
  index: number;
  questionId: string;
  isTiebreak: boolean;
  participants: string[];   // turn order for this question
  turnIndex: number;
  turn: Turn | null;        // null once the round is finished
  claimed: Record<string, string>; // rank → attemptId
  rotationBefore: string[]; // game rotation when this question started (restored if a turn is replayed after it ended)
  finished: boolean;
  startedAt: number;
}

export type Phase = 'lobby' | 'question' | 'results' | 'finished';
export type NextStep = 'next_question' | 'tiebreak' | 'finished';
export type FinishReason = 'winner' | 'out_of_questions' | 'ended_by_host' | 'shared_win';

export interface CardUse {
  playerId: string;
  card: 'wild' | 'streak';
  roundIndex: number;
  attemptId: string | null; // filled when the card takes effect
  at: number;
}

export interface GameState {
  v: 1;
  config: GameConfig;
  phase: Phase;
  paused: boolean;
  categories: string[];
  players: Player[];
  rotation: string[];
  queue: string[];
  rounds: Round[];
  attempts: Attempt[];
  cardLog: CardUse[];
  endgame: { triggered: boolean; byAttemptId: string | null };
  nextStep: NextStep | null;
  tiedPlayerIds: string[];
  outcome: { winnerIds: string[]; reason: FinishReason } | null;
  turnSerial: number;
  seq: number;
  createdAt: number;
  /** The running countdown (server time). Frozen while paused (deadline null, remainingMs kept). */
  timer?: GameTimer | null;
}

export type TimerKind = 'answer' | 'streak' | 'next';
export interface GameTimer { key: string; kind: TimerKind; deadline: number | null; remainingMs: number | null; totalMs: number }

export type Actor = { role: 'host' } | { role: 'player'; playerId: string } | { role: 'system' };

export type Action =
  | { type: 'join'; playerId: string; name: string; color?: string; emoji?: string }
  | { type: 'leave' }
  | { type: 'remove_player'; playerId: string }
  | { type: 'set_categories'; categories: string[] }
  | { type: 'start'; questionIds: string[] }
  | { type: 'confirm'; rank: number; turnSerial: number }
  | { type: 'reject'; reason: 'incorrect' | 'already_claimed' | 'pass'; turnSerial: number }
  | { type: 'skip_turn'; turnSerial: number }
  | { type: 'end_turn'; turnSerial: number }
  | { type: 'activate_wild'; turnSerial: number }
  | { type: 'activate_streak'; turnSerial: number }
  | { type: 'void_attempt'; attemptId: string; replayTurn: boolean }
  | { type: 'end_question' }
  | { type: 'submit_answer'; text: string; turnSerial: number }
  | { type: 'timeout'; turnSerial: number }
  | { type: 'next_question' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end_game' };

export type ErrorCode =
  | 'NOT_HOST' | 'NOT_PLAYER' | 'NOT_YOUR_TURN' | 'WRONG_PHASE' | 'PAUSED' | 'STALE_TURN'
  | 'ALREADY_CLAIMED' | 'INVALID_RANK' | 'CARD_USED' | 'CARD_NOT_ALLOWED_NOW'
  | 'NAME_TAKEN' | 'NAME_INVALID' | 'GAME_FULL' | 'ALREADY_JOINED' | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_ENOUGH_QUESTIONS' | 'NO_CATEGORIES' | 'UNKNOWN_PLAYER' | 'UNKNOWN_ATTEMPT'
  | 'CANNOT_REPLAY' | 'ANSWER_INVALID' | 'TOO_EARLY' | 'NO_TIMER' | 'NOTHING_CLAIMED' | 'ALREADY_VOIDED' | 'NOT_CURRENT_QUESTION' | 'GAME_FINISHED' | 'NOT_PAUSED' | 'UNKNOWN_ACTION';

export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ErrorCode };
