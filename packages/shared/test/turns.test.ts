import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, P, newGame } from './helpers.ts';

test('turn order rotates after every completed question', () => {
  const g = newGame(['Ahmed', 'Omar', 'Sara', 'Ali']);
  assert.deepEqual(g.round.participants, ['Ahmed', 'Omar', 'Sara', 'Ali']);
  for (let i = 0; i < 4; i++) g.answer(null);
  assert.equal(g.state.phase, 'results');
  g.next();
  assert.deepEqual(g.round.participants, ['Omar', 'Sara', 'Ali', 'Ahmed']);
  for (let i = 0; i < 4; i++) g.answer(null);
  g.next();
  assert.deepEqual(g.round.participants, ['Sara', 'Ali', 'Ahmed', 'Omar']);
});

test('each player gets one turn per question, in order', () => {
  const g = newGame(['A', 'B', 'C']);
  assert.equal(g.turnPlayer, 'A');
  g.answer(3);
  assert.equal(g.turnPlayer, 'B');
  g.answer(null);
  assert.equal(g.turnPlayer, 'C');
  g.answer(4);
  assert.equal(g.state.phase, 'results');
  assert.equal(g.round.finished, true);
});

test('edge 5: answer outside the 12 → zero and the turn ends', () => {
  const g = newGame();
  g.wrong();
  assert.equal(g.score('A'), 0);
  assert.equal(g.turnPlayer, 'B');
});

test('the question ends early once all 12 answers are claimed', () => {
  const names = Array.from({ length: 14 }, (_, i) => `P${i}`);
  const g = newGame(names);
  for (let r = 1; r <= 12; r++) g.answer(r);
  assert.equal(g.state.phase, 'results');
  assert.equal(Object.keys(g.round.claimed).length, 12);
});

test('only the host can rule on answers; players get NOT_HOST', () => {
  const g = newGame();
  g.fail(P('A'), { type: 'confirm', rank: 1, turnSerial: g.serial }, 'NOT_HOST');
  g.fail(P('B'), { type: 'reject', reason: 'incorrect', turnSerial: g.serial }, 'NOT_HOST');
});

test('invalid rank is refused', () => {
  const g = newGame();
  g.fail(HOST, { type: 'confirm', rank: 13, turnSerial: g.serial }, 'INVALID_RANK');
  g.fail(HOST, { type: 'confirm', rank: 0, turnSerial: g.serial }, 'INVALID_RANK');
});

test('edge 19: host can skip a disconnected player; order stays intact', () => {
  const g = newGame(['A', 'B', 'C']);
  g.skip();
  assert.equal(g.score('A'), 0);
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.state.attempts[0].outcome, 'skipped');
});

test('edge 21: duplicate validation (double tap / late repeat) is rejected as stale', () => {
  const g = newGame(['A', 'B', 'C']);
  const serial = g.serial;
  g.do(HOST, { type: 'confirm', rank: 4, turnSerial: serial });
  g.done();
  g.fail(HOST, { type: 'confirm', rank: 5, turnSerial: serial }, 'STALE_TURN');
  assert.equal(g.score('A'), 4);
  assert.equal(g.score('B'), 0);
});

test('a repeated confirm while the Streak choice is open is refused', () => {
  const g = newGame(['A', 'B']);
  const serial = g.serial;
  g.do(HOST, { type: 'confirm', rank: 4, turnSerial: serial });
  g.fail(HOST, { type: 'confirm', rank: 4, turnSerial: serial }, 'STALE_TURN');
  g.fail(HOST, { type: 'confirm', rank: 6, turnSerial: serial }, 'STALE_TURN');
});

test('edge 22: pause blocks every game action, resume continues unchanged', () => {
  const g = newGame();
  g.answer(2);
  g.do(HOST, { type: 'pause' });
  g.fail(HOST, { type: 'confirm', rank: 3, turnSerial: g.serial }, 'PAUSED');
  g.fail(P('B'), { type: 'activate_wild', turnSerial: g.serial }, 'PAUSED');
  g.fail(HOST, { type: 'skip_turn', turnSerial: g.serial }, 'PAUSED');
  g.do(HOST, { type: 'pause' }); // harmless repeat
  g.fail(P('B'), { type: 'resume' }, 'NOT_HOST');
  g.do(HOST, { type: 'resume' });
  g.fail(HOST, { type: 'resume' }, 'NOT_PAUSED');
  assert.equal(g.turnPlayer, 'B');
  g.answer(3);
  assert.equal(g.score('B'), 3);
});

test('the server (system) can pause when the host drops, only the host resumes', () => {
  const g = newGame();
  g.do({ role: 'system' }, { type: 'pause' });
  assert.equal(g.state.paused, true);
  g.fail({ role: 'system' }, { type: 'resume' }, 'NOT_HOST');
});

test('host can end the game; top score wins', () => {
  const g = newGame();
  g.answer(9);
  g.do(HOST, { type: 'end_game' });
  assert.equal(g.state.phase, 'finished');
  assert.deepEqual(g.state.outcome, { winnerIds: ['A'], reason: 'ended_by_host' });
  g.fail(HOST, { type: 'next_question' }, 'GAME_FINISHED');
});
