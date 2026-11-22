import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildView, finalSummary } from '../src/views.ts';
import { HOST, content, newGame } from './helpers.ts';

test('same player claims rank 11 and rank 12 on different turns → +20 instead of −23', () => {
  const g = newGame(['A', 'B']);
  g.answer(11);           // A −11
  assert.equal(g.score('A'), -11);
  g.answer(3);            // B +3
  g.answer(12);           // A again → combo
  assert.equal(g.score('A'), 20);
  assert.ok(g.events.some((e) => e.type === 'combo_11_12' && e.playerId === 'A'));
});

test('order does not matter: 12 first, then 11', () => {
  const g = newGame(['A', 'B']);
  g.answer(12); g.answer(1); g.answer(11);
  assert.equal(g.score('A'), 20);
});

test('different players holding 11 and 12 keep their normal negative points', () => {
  const g = newGame(['A', 'B']);
  g.answer(11); g.answer(12);
  assert.equal(g.score('A'), -11);
  assert.equal(g.score('B'), -12);
});

test('combo in one turn with Streak', () => {
  const g = newGame(['A', 'B']);
  g.confirm(11);
  g.streak('A');
  g.confirm(12);
  assert.equal(g.score('A'), 20);
});

test('Wild does not multiply the combo: it stays 20', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.answer(11);           // −55 on its own
  assert.equal(g.score('A'), -55);
  g.answer(2);
  g.answer(12);
  assert.equal(g.score('A'), 20);
});

test('the combo is per question: 11 in one question and 12 in the next do not combine', () => {
  const g = newGame(['A', 'B']);
  g.answer(11); g.answer(null); g.endQ(); g.next();   // next question starts with B
  g.answer(null); g.answer(12);
  assert.equal(g.score('A'), -23);
});

test('undoing one half of the combo brings back the normal points', () => {
  const g = newGame(['A', 'B']);
  g.answer(11); g.answer(1); g.answer(12);
  assert.equal(g.score('A'), 20);
  const last = g.state.attempts[g.state.attempts.length - 1];
  g.do(HOST, { type: 'void_attempt', attemptId: last.id, replayTurn: false });
  assert.equal(g.score('A'), -11);
});

test('a Streak failure that cancels rank 11 also cancels the combo', () => {
  const g = newGame(['A', 'B']);
  g.answer(12);           // A −12
  g.answer(1);
  g.confirm(11);          // A combo → +20
  assert.equal(g.score('A'), 20);
  g.streak('A');
  g.wrong();              // Streak fails → rank 11 points cancelled → back to −12
  assert.equal(g.score('A'), -12);
});

test('views and final stats show the combo', () => {
  const g = newGame(['A', 'B']);
  g.answer(11); g.answer(1); g.answer(12);
  const v = buildView(g.state, content(), { role: 'player', playerId: 'B' });
  const a = v.round!.attempts.filter((x) => x.combo);
  assert.equal(a.length, 2);
  assert.equal(a.reduce((n, x) => n + x.points, 0), 20);
  assert.equal(v.leaderboard.find((r) => r.id === 'A')!.lastDelta, 20);
  g.do(HOST, { type: 'end_game' });
  const sum = finalSummary(g.state).players.find((p) => p.id === 'A')!;
  assert.equal(sum.pointsGained, 20);
  assert.equal(sum.pointsLost, 0);
});
