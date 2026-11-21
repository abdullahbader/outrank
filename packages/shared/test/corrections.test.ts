import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, P, newGame } from './helpers.ts';

const lastAttempt = (g: ReturnType<typeof newGame>) => g.state.attempts[g.state.attempts.length - 1];

test('edge 17: wrong answer confirmed by accident → void removes points and frees the answer', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(10);
  const a = lastAttempt(g);
  g.do(HOST, { type: 'void_attempt', attemptId: a.id, replayTurn: false });
  assert.equal(g.score('A'), 0);
  assert.equal(g.round.claimed['10'], undefined);
  assert.equal(g.turnPlayer, 'B', 'turns do not rewind on their own');
  g.answer(10);
  assert.equal(g.score('B'), 20, 'the freed answer can be claimed');
  assert.ok(g.events.some((e) => e.type === 'attempt_voided'));
});

test('void + give the turn back replays the most recent turn', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(2);
  g.answer(null); // B marked wrong by mistake
  const a = lastAttempt(g);
  g.do(HOST, { type: 'void_attempt', attemptId: a.id, replayTurn: true });
  assert.equal(g.turnPlayer, 'B');
  g.answer(6);
  assert.equal(g.score('B'), 6);
  assert.equal(g.turnPlayer, 'C');
});

test('replay is only possible for the most recent answer', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(2);
  const first = lastAttempt(g);
  g.answer(3);
  g.fail(HOST, { type: 'void_attempt', attemptId: first.id, replayTurn: true }, 'CANNOT_REPLAY');
});

test('voiding a Wild answer gives the card back', () => {
  const g = newGame(['A', 'B']);
  g.wild('A'); g.answer(5);
  assert.equal(g.score('A'), 25);
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: true });
  assert.equal(g.score('A'), 0);
  assert.equal(g.card('A').wild, 'available');
  assert.equal(g.turnPlayer, 'A');
  assert.equal(g.state.cardLog.length, 0);
});

test('voiding the first answer while the Streak choice is open restarts that turn', () => {
  const g = newGame(['A', 'B']);
  g.confirm(8);
  assert.equal(g.round.turn!.awaitingStreakDecision, true);
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: false });
  assert.equal(g.turnPlayer, 'A');
  assert.equal(g.round.turn!.awaitingStreakDecision, false);
  assert.equal(g.round.turn!.attemptNo, 1);
  assert.equal(g.score('A'), 0);
});

test('voiding the first answer after Streak was switched on gives Streak back', () => {
  const g = newGame(['A', 'B']);
  g.confirm(8);
  g.streak('A');
  const first = g.state.attempts[0];
  g.do(HOST, { type: 'void_attempt', attemptId: first.id, replayTurn: false });
  assert.equal(g.card('A').streak, 'available');
  assert.equal(g.round.turn!.attemptNo, 1);
});

test('voiding a failed Streak second attempt restores the first answer\'s points', () => {
  const g = newGame(['A', 'B']);
  g.confirm(9);
  g.streak('A');
  g.wrong();
  assert.equal(g.score('A'), 0);
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: true });
  assert.equal(g.score('A'), 9);
  assert.equal(g.turnPlayer, 'A');
  assert.equal(g.round.turn!.attemptNo, 2, 'replays the Streak attempt');
  g.confirm(4);
  assert.equal(g.score('A'), 13);
});

test('a correction can reopen a finished question before Continue', () => {
  const g = newGame(['A', 'B']);
  g.answer(1);
  g.answer(null); // last turn → results
  assert.equal(g.state.phase, 'results');
  const rotationAfter = [...g.state.rotation];
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: true });
  assert.equal(g.state.phase, 'question');
  assert.equal(g.turnPlayer, 'B');
  assert.notDeepEqual(g.state.rotation, rotationAfter);
  g.answer(12);
  assert.equal(g.state.phase, 'results');
  assert.deepEqual(g.state.rotation, rotationAfter);
});

test('voiding the answer that reached the target un-triggers the endgame', () => {
  const g = newGame(['A', 'B'], { targetScore: 20 });
  g.answer(10);
  assert.equal(g.state.endgame.triggered, true);
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: false });
  assert.equal(g.state.endgame.triggered, false);
  g.answer(1);
  assert.equal(g.state.nextStep, 'next_question');
});

test('voiding in results recomputes what comes next', () => {
  const g = newGame(['A', 'B'], { targetScore: 20 });
  g.answer(1); g.answer(10); // B 20 → finished
  assert.equal(g.state.nextStep, 'finished');
  g.do(HOST, { type: 'void_attempt', attemptId: lastAttempt(g).id, replayTurn: false });
  assert.equal(g.state.nextStep, 'next_question');
});

test('corrections: host only, current question only, once', () => {
  const g = newGame(['A', 'B']);
  g.answer(1);
  const a = lastAttempt(g);
  g.fail(P('A'), { type: 'void_attempt', attemptId: a.id, replayTurn: false }, 'NOT_HOST');
  g.do(HOST, { type: 'void_attempt', attemptId: a.id, replayTurn: false });
  g.fail(HOST, { type: 'void_attempt', attemptId: a.id, replayTurn: false }, 'ALREADY_VOIDED');
  g.fail(HOST, { type: 'void_attempt', attemptId: 'nope', replayTurn: false }, 'UNKNOWN_ATTEMPT');
  g.answer(2);
  const b = lastAttempt(g);
  g.next();
  g.fail(HOST, { type: 'void_attempt', attemptId: b.id, replayTurn: false }, 'NOT_CURRENT_QUESTION');
});

test('scores always equal the sum of valid answers', () => {
  const g = newGame(['A', 'B', 'C']);
  g.wild('A'); g.answer(3);
  g.confirm(10); g.streak('B'); g.confirm(11);
  g.answer(12);
  g.do(HOST, { type: 'void_attempt', attemptId: g.state.attempts[1].id, replayTurn: false });
  for (const p of g.state.players) {
    const sum = g.state.attempts
      .filter((a) => a.playerId === p.id && !a.voided && !a.cancelledByStreak && a.outcome === 'correct')
      .reduce((n, a) => n + a.points, 0);
    assert.equal(p.score, sum);
  }
});
