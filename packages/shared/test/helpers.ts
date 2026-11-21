import assert from 'node:assert/strict';
import { apply, createGame } from '../src/engine.ts';
import type { Action, Actor, GameConfig, GameState } from '../src/types.ts';
import type { QuestionContent } from '../src/views.ts';

export const HOST: Actor = { role: 'host' };
export const P = (playerId: string): Actor => ({ role: 'player', playerId });

let clock = 1_000;

export class Game {
  state: GameState;
  events: { type: string; [k: string]: unknown }[] = [];
  constructor(state: GameState) { this.state = state; }

  do(actor: Actor, action: Action) {
    const r = apply(this.state, actor, action, (clock += 1000));
    if (!r.ok) throw new Error(`Expected ok for ${action.type}, got ${r.error}`);
    this.state = r.state;
    this.events.push(...r.events);
    return r.events;
  }

  fail(actor: Actor, action: Action, error: string) {
    const before = JSON.stringify(this.state);
    const r = apply(this.state, actor, action, (clock += 1000));
    assert.equal(r.ok, false, `Expected ${error} for ${action.type}`);
    if (!r.ok) assert.equal(r.error, error);
    assert.equal(JSON.stringify(this.state), before, 'state must not change on error');
  }

  get serial() { return this.state.turnSerial; }
  get round() { return this.state.rounds[this.state.rounds.length - 1]; }
  get turnPlayer() { return this.round.turn?.playerId ?? null; }
  score(id: string) { return this.state.players.find((p) => p.id === id)!.score; }
  card(id: string) { const p = this.state.players.find((x) => x.id === id)!; return { wild: p.wild, streak: p.streak }; }

  confirm(rank: number) { return this.do(HOST, { type: 'confirm', rank, turnSerial: this.serial }); }
  wrong() { return this.do(HOST, { type: 'reject', reason: 'incorrect', turnSerial: this.serial }); }
  claimedAgain() { return this.do(HOST, { type: 'reject', reason: 'already_claimed', turnSerial: this.serial }); }
  skip() { return this.do(HOST, { type: 'skip_turn', turnSerial: this.serial }); }
  done() { return this.do(HOST, { type: 'end_turn', turnSerial: this.serial }); }
  wild(id: string) { return this.do(P(id), { type: 'activate_wild', turnSerial: this.serial }); }
  streak(id: string) { return this.do(P(id), { type: 'activate_streak', turnSerial: this.serial }); }
  next() { return this.do(HOST, { type: 'next_question' }); }
  /** Host ends the current question now. */
  endQ() { return this.do(HOST, { type: 'end_question' }); }

  /** Answer for whoever's turn it is; declines Streak automatically when offered. */
  answer(rank: number | null) {
    if (rank === null) this.wrong(); else this.confirm(rank);
    if (this.round.turn?.awaitingStreakDecision) this.done();
  }
}

export const qid = (i: number) => `q${i}`;

export function newGame(names = ['A', 'B', 'C'], config: Partial<GameConfig> = {}, questions = 20): Game {
  const g = new Game(createGame({ now: 0, config, categories: ['geography'] }));
  for (const n of names) g.do(P(n), { type: 'join', playerId: n, name: n });
  g.do(HOST, { type: 'start', questionIds: Array.from({ length: questions }, (_, i) => qid(i + 1)) });
  return g;
}

export function content(n = 30): Record<string, QuestionContent> {
  const out: Record<string, QuestionContent> = {};
  for (let i = 1; i <= n; i++) {
    out[qid(i)] = {
      id: qid(i),
      categoryId: 'geography',
      title: { en: `Question ${i}` },
      difficulty: 1,
      answers: Array.from({ length: 12 }, (_, k) => ({ rank: k + 1, text: { en: `SECRET-${i}-${k + 1}` }, aliases: [`alias-${k + 1}`] })),
    };
  }
  return out;
}
