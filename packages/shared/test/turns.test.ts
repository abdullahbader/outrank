import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, P, newGame } from './helpers.ts';

test('turn order rotates after every completed question', () => {
  const g = newGame(['Ahmed', 'Omar', 'Sara', 'Ali']);
  assert.deepEqual(g.round.participants, ['Ahmed', 'Omar', 'Sara', 'Ali']);
  for (let i = 0; i < 4; i++) g.answer(null);
  g.endQ();
  assert.equal(g.state.phase, 'results');
  g.next();
  assert.deepEqual(g.round.participants, ['Omar', 'Sara', 'Ali', 'Ahmed']);
  for (let i = 0; i < 4; i++) g.answer(null);
  g.endQ();
  g.next();
  assert.deepEqual(g.round.participants, ['Sara', 'Ali', 'Ahmed', 'Omar']);
});

test('turns keep going round the table until ranks 1–10 are all claimed', () => {
  const g = newGame(['A', 'B', 'C']);
  assert.equal(g.turnPlayer, 'A');
  g.answer(3);
  g.answer(null);
  g.answer(4);
  assert.equal(g.state.phase, 'question', 'one lap is not the end');
  assert.equal(g.turnPlayer, 'A', 'back to the first player');
  assert.equal(g.round.turnIndex, 3);
  for (const r of [1, 2, 5, 6, 7, 8, 9]) g.answer(r);
  assert.equal(g.state.phase, 'question', 'rank 10 still open');
  g.answer(11); // a negative claim does not end it
  assert.equal(g.state.phase, 'question');
  g.answer(10);
  assert.equal(g.state.phase, 'results', 'all positive answers claimed → question over');
  assert.equal(g.round.claimed['12'], undefined, 'rank 12 may stay unclaimed');
});

test('the host can end (skip) a question at any time', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(2);
  g.fail(P('B'), { type: 'end_question' }, 'NOT_HOST');
  g.endQ();
  assert.equal(g.state.phase, 'results');
  assert.equal(g.score('A'), 2, 'points already won stay');
  assert.deepEqual(g.state.rotation, ['B', 'C', 'A'], 'rotation still applies');
  g.fail(HOST, { type: 'end_question' }, 'WRONG_PHASE');
});

test('ending a question mid-Streak keeps the first answer and returns the cards', () => {
  const g = newGame(['A', 'B']);
  g.confirm(6);
  g.streak('A');
  g.wild('A');
  g.endQ();
  assert.equal(g.score('A'), 6);
  assert.deepEqual(g.card('A'), { wild: 'available', streak: 'available' });
  assert.equal(g.state.cardLog.length, 0);
});

test('edge 5: answer outside the 12 → zero and the turn ends', () => {
  const g = newGame();
  g.wrong();
  assert.equal(g.score('A'), 0);
  assert.equal(g.turnPlayer, 'B');
});

test('a question with every answer claimed is over', () => {
  const names = Array.from({ length: 14 }, (_, i) => `P${i}`);
  const g = newGame(names);
  for (const r of [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) g.answer(r);
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
