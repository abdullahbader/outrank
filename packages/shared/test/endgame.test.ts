import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, newGame } from './helpers.ts';

test('edge 13: reaching 100 mid-question → event, the question carries on, then the game ends', () => {
  const g = newGame(['A', 'B', 'C']);
  g.wild('A'); g.answer(10); // A = 100
  assert.ok(g.events.some((e) => e.type === 'target_reached'));
  assert.equal(g.state.endgame.triggered, true);
  assert.equal(g.state.phase, 'question', 'the question continues');
  g.answer(9); g.answer(8);
  assert.equal(g.turnPlayer, 'A', 'still going round the table');
  for (const r of [1, 2, 3, 4, 5, 6, 7]) g.answer(r);
  assert.equal(g.state.phase, 'results', 'ends when every positive answer is claimed');
  assert.equal(g.state.nextStep, 'finished');
  g.next();
  assert.equal(g.state.phase, 'finished');
  assert.deepEqual(g.state.outcome!.winnerIds, ['A']);
});

test('after the target is reached the host can end the question; no new regular question starts', () => {
  const g = newGame(['A', 'B'], { targetScore: 10 });
  g.answer(10); g.answer(1);
  g.endQ();
  assert.equal(g.state.nextStep, 'finished');
  const before = g.state.rounds.length;
  g.next();
  assert.equal(g.state.rounds.length, before);
  assert.equal(g.state.phase, 'finished');
});

test('edge 14: several reach the target in the same question → highest final score wins', () => {
  const g = newGame(['A', 'B', 'C'], { targetScore: 30 });
  g.answer(10); g.answer(9); g.answer(8); g.endQ(); g.next();  // A20 B9 C8 — next order B C A
  g.answer(10); g.answer(7); g.answer(9); g.endQ(); g.next();  // B29 C15 A29 — next order C A B
  g.answer(10); g.answer(2); g.answer(3);                      // C35 A31 B32 — all three ≥ 30
  g.endQ();
  assert.equal(g.state.nextStep, 'finished');
  g.next();
  assert.deepEqual(g.state.outcome!.winnerIds, ['C']);
});

test('dropping back under the target in the final question does not cancel the endgame', () => {
  const g = newGame(['A', 'B'], { targetScore: 20 });
  g.confirm(10);        // A 20 → triggered
  g.streak('A');
  g.wrong();            // Streak fails → A back to 0
  assert.equal(g.score('A'), 0);
  assert.equal(g.state.endgame.triggered, true);
  g.answer(1);          // B 1
  g.endQ();
  assert.equal(g.state.nextStep, 'finished');
  g.next();
  assert.deepEqual(g.state.outcome!.winnerIds, ['B']);
});

test('edge 15: tie for the top → tie-breaker with the tied players only, in rotated order', () => {
  const g = newGame(['A', 'B', 'C'], { targetScore: 20 });
  g.wild('A'); g.answer(4);  // A 20 (triggered)
  g.answer(10);              // B 20
  g.answer(1);               // C 1
  g.endQ();
  assert.equal(g.state.nextStep, 'tiebreak');
  assert.deepEqual([...g.state.tiedPlayerIds].sort(), ['A', 'B']);
  g.next();
  assert.equal(g.round.isTiebreak, true);
  assert.deepEqual(g.round.participants, ['B', 'A']);
  assert.ok(!g.round.participants.includes('C'));
  g.answer(3);               // B 23
  g.answer(2);               // A 22
  assert.equal(g.turnPlayer, 'B', 'tie-breakers also go round until the host ends them or positives run out');
  g.endQ();
  assert.equal(g.state.nextStep, 'finished');
  g.next();
  assert.deepEqual(g.state.outcome, { winnerIds: ['B'], reason: 'winner' });
});

test('edge 16: tie-breaker still tied → another tie-breaker; unused cards stay available', () => {
  const g = newGame(['A', 'B'], { targetScore: 20 });
  g.wild('A'); g.answer(4); g.answer(10);  // A20 B20
  g.endQ();
  g.next();                                 // tie-breaker 1: B, A
  g.answer(null); g.answer(null);
  g.endQ();
  assert.equal(g.state.nextStep, 'tiebreak');
  g.next();                                 // tie-breaker 2: A, B
  assert.deepEqual(g.round.participants, ['A', 'B']);
  assert.equal(g.card('A').wild, 'used', 'used cards stay used');
  assert.equal(g.card('B').wild, 'available', 'unused cards remain available');
  g.answer(1);                              // A 21
  g.wild('B'); g.answer(2);                 // B 30
  g.endQ();
  g.next();
  assert.deepEqual(g.state.outcome!.winnerIds, ['B']);
});

test('running out of questions ends on current scores; a tied top shares the win', () => {
  const g = newGame(['A', 'B'], { minQuestions: 1 }, 1);
  g.answer(3); g.answer(4);
  g.endQ();
  assert.equal(g.state.nextStep, 'finished');
  g.next();
  assert.deepEqual(g.state.outcome, { winnerIds: ['B'], reason: 'out_of_questions' });

  const s = newGame(['A', 'B'], { minQuestions: 1 }, 1);
  s.answer(null); s.answer(null);
  s.endQ();
  s.next();
  assert.equal(s.state.outcome!.reason, 'shared_win');
  assert.deepEqual([...s.state.outcome!.winnerIds].sort(), ['A', 'B']);
});

test('host ending the game early: top score wins, ties share', () => {
  const g = newGame(['A', 'B']);
  g.answer(null);
  g.do(HOST, { type: 'end_game' });
  assert.deepEqual([...g.state.outcome!.winnerIds].sort(), ['A', 'B']);
});
