import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, P, newGame } from './helpers.ts';

// ── exclusivity

test('edge 6: an already-claimed answer cannot be awarded again', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(1); // A claims rank 1 (Russia)
  g.fail(HOST, { type: 'confirm', rank: 1, turnSerial: g.serial }, 'ALREADY_CLAIMED');
  g.claimedAgain();
  assert.equal(g.score('B'), 0);
  assert.equal(g.turnPlayer, 'C');
  assert.equal(g.state.attempts[1].outcome, 'already_claimed');
});

test('claims reset when a new question starts', () => {
  const g = newGame(['A', 'B']);
  g.answer(1); g.answer(2);
  g.endQ();
  g.next();
  assert.deepEqual(g.round.claimed, {});
  g.answer(1);
  assert.equal(g.score('B'), 2 + 1, 'B starts question 2 and can claim rank 1 again');
});

test('edge 12: two near-simultaneous claims — only one is applied', () => {
  const g = newGame(['A', 'B']);
  const serial = g.serial;
  // Both requests were made against the same state; the server applies them one after the other.
  g.do(HOST, { type: 'confirm', rank: 7, turnSerial: serial });
  g.fail(HOST, { type: 'confirm', rank: 7, turnSerial: serial }, 'STALE_TURN');
  assert.equal(g.score('A'), 7);
  assert.equal(g.state.attempts.length, 1);
});

// ── Wild

test('edge 7: Wild multiplies by five (rank 5 → 25, rank 10 → 100)', () => {
  const g = newGame(['A', 'B', 'C']);
  g.wild('A');
  assert.equal(g.card('A').wild, 'armed');
  g.answer(5);
  assert.equal(g.score('A'), 25);
  assert.equal(g.card('A').wild, 'used');
  g.wild('B');
  g.answer(10);
  assert.equal(g.score('B'), 100);
});

test('edge 8: Wild on a negative answer → rank 11 = −55', () => {
  const g = newGame();
  g.wild('A');
  g.answer(11);
  assert.equal(g.score('A'), -55);
});

test('Wild on a wrong answer is used up with no effect', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.wrong();
  assert.equal(g.card('A').wild, 'used');
  assert.equal(g.score('A'), 0);
});

test('Wild comes back if the host skips the turn (no answer given)', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.skip();
  assert.equal(g.card('A').wild, 'available');
  assert.equal(g.state.cardLog.length, 0);
});

test('edge 11: a card cannot be used twice', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.fail(P('A'), { type: 'activate_wild', turnSerial: g.serial }, 'CARD_USED');
  g.answer(3);
  g.answer(1);
  g.endQ();
  g.next(); // B starts, then A
  g.answer(2);
  g.fail(P('A'), { type: 'activate_wild', turnSerial: g.serial }, 'CARD_USED');
});

test('cards only on your own turn, and never by the host', () => {
  const g = newGame(['A', 'B']);
  g.fail(P('B'), { type: 'activate_wild', turnSerial: g.serial }, 'NOT_YOUR_TURN');
  g.fail(HOST, { type: 'activate_wild', turnSerial: g.serial }, 'NOT_PLAYER');
  g.fail(P('A'), { type: 'activate_streak', turnSerial: g.serial }, 'CARD_NOT_ALLOWED_NOW');
});

// ── Streak

test('Streak is offered after a correct first answer; Done ends the turn', () => {
  const g = newGame(['A', 'B']);
  g.confirm(4);
  assert.equal(g.round.turn!.awaitingStreakDecision, true);
  assert.equal(g.turnPlayer, 'A');
  g.do(P('A'), { type: 'end_turn', turnSerial: g.serial }); // the player can decline themselves
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.card('A').streak, 'available');
});

test('other players cannot end someone else\'s turn', () => {
  const g = newGame(['A', 'B']);
  g.confirm(4);
  g.fail(P('B'), { type: 'end_turn', turnSerial: g.serial }, 'NOT_YOUR_TURN');
});

test('no Streak offer after a wrong answer, or once Streak is used', () => {
  const g = newGame(['A', 'B']);
  g.wrong();
  assert.equal(g.turnPlayer, 'B');
});

test('edge 9: Streak, both correct → points for both', () => {
  const g = newGame(['A', 'B']);
  g.confirm(6);
  g.streak('A');
  assert.equal(g.round.turn!.attemptNo, 2);
  g.confirm(8);
  assert.equal(g.score('A'), 14);
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.card('A').streak, 'used');
});

test('edge 10: Streak, second wrong → first answer\'s points lost, answer stays claimed', () => {
  const g = newGame(['A', 'B']);
  g.confirm(9);
  g.streak('A');
  g.wrong();
  assert.equal(g.score('A'), 0);
  assert.ok(g.round.claimed['9'], 'rank 9 stays claimed');
  assert.equal(g.turnPlayer, 'B');
  g.fail(HOST, { type: 'confirm', rank: 9, turnSerial: g.serial }, 'ALREADY_CLAIMED');
});

test('Streak second attempt must be unclaimed; a claimed answer counts as a failure', () => {
  const g = newGame(['A', 'B']);
  g.confirm(3);
  g.streak('A');
  g.fail(HOST, { type: 'confirm', rank: 3, turnSerial: g.serial }, 'ALREADY_CLAIMED');
  g.claimedAgain();
  assert.equal(g.score('A'), 0);
});

test('Streak failure after a negative first answer cancels the negative points', () => {
  const g = newGame(['A', 'B']);
  g.confirm(11);
  assert.equal(g.score('A'), -11);
  g.streak('A');
  g.wrong();
  assert.equal(g.score('A'), 0);
});

test('Wild + Streak in one turn: Wild on the second attempt', () => {
  const g = newGame(['A', 'B']);
  g.confirm(2);
  g.streak('A');
  g.wild('A');
  g.confirm(7);
  assert.equal(g.score('A'), 2 + 35);
});

test('Wild + Streak: Wild on first, Streak fails → the ×5 points are lost', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.confirm(4); // 20
  g.streak('A');
  g.wrong();
  assert.equal(g.score('A'), 0);
  assert.deepEqual(g.card('A'), { wild: 'used', streak: 'used' });
});

test('Wild cannot be switched on during the Streak choice', () => {
  const g = newGame(['A', 'B']);
  g.confirm(2);
  g.fail(P('A'), { type: 'activate_wild', turnSerial: g.serial }, 'CARD_NOT_ALLOWED_NOW');
});

test('skipping a Streak second attempt counts as failing it', () => {
  const g = newGame(['A', 'B']);
  g.confirm(5);
  g.streak('A');
  g.skip();
  assert.equal(g.score('A'), 0);
});

test('no Streak offer when the answer claims the last positive answer', () => {
  const g = newGame(['A', 'B']);
  for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 9]) g.answer(r);
  g.confirm(10); // whoever's turn it is still has Streak, but nothing positive is left
  assert.equal(g.state.phase, 'results');
});

test('card activations are logged for the host', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.confirm(1);
  g.streak('A');
  g.confirm(2);
  assert.deepEqual(g.state.cardLog.map((c) => [c.playerId, c.card]), [['A', 'wild'], ['A', 'streak']]);
  assert.ok(g.state.cardLog.every((c) => c.attemptId));
});
