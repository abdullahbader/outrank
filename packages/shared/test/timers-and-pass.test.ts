import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/engine.ts';
import { HOST, P, newGame } from './helpers.ts';

const SYS = { role: 'system' } as const;

/** Runs the server's "time is up" message at a given clock time. */
function timeout(g: ReturnType<typeof newGame>, at: number) {
  const r = apply(g.state, SYS, { type: 'timeout', turnSerial: g.state.turnSerial }, at);
  if (r.ok) { g.state = r.state; g.events.push(...r.events); }
  return r;
}

test('every turn gets an answer countdown (30 s by default)', () => {
  const g = newGame(['A', 'B']);
  const tm = g.state.timer!;
  assert.equal(tm.kind, 'answer');
  assert.equal(tm.totalMs, 30_000);
  assert.ok(tm.deadline! > 0);
});

test('answer timer at zero: no points, the turn moves on (Wild used up)', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  const deadline = g.state.timer!.deadline!;
  const early = apply(g.state, SYS, { type: 'timeout', turnSerial: g.state.turnSerial }, deadline - 5_000);
  assert.equal(early.ok, false);
  if (!early.ok) assert.equal(early.error, 'TOO_EARLY');
  assert.equal(timeout(g, deadline).ok, true);
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.state.attempts[0].outcome, 'timed_out');
  assert.equal(g.score('A'), 0);
  assert.equal(g.card('A').wild, 'used');
  assert.equal(g.state.timer!.kind, 'answer', 'B gets a fresh countdown');
  assert.ok(g.state.timer!.deadline! > deadline);
});

test('only the server clock can time a turn out; a stale timeout is ignored', () => {
  const g = newGame(['A', 'B']);
  const d = g.state.timer!.deadline!;
  assert.equal(apply(g.state, HOST, { type: 'timeout', turnSerial: g.state.turnSerial }, d).ok, false);
  const serial = g.state.turnSerial;
  g.answer(3);
  const r = apply(g.state, SYS, { type: 'timeout', turnSerial: serial }, d + 60_000);
  assert.equal(r.ok, false);
});

test('Streak decision has its own 10 s countdown; at zero the turn ends with the points kept', () => {
  const g = newGame(['A', 'B']);
  g.confirm(6);
  assert.equal(g.state.timer!.kind, 'streak');
  assert.equal(g.state.timer!.totalMs, 10_000);
  timeout(g, g.state.timer!.deadline!);
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.score('A'), 6);
  assert.equal(g.card('A').streak, 'available');
});

test('timing out on the Streak extra answer counts as failing it', () => {
  const g = newGame(['A', 'B']);
  g.confirm(6);
  g.streak('A');
  timeout(g, g.state.timer!.deadline!);
  assert.equal(g.score('A'), 0);
});

test('results screen counts down, then the next question starts by itself', () => {
  const g = newGame(['A', 'B']);
  g.endQ();
  assert.equal(g.state.timer!.kind, 'next');
  timeout(g, g.state.timer!.deadline!);
  assert.equal(g.state.phase, 'question');
  assert.equal(g.state.rounds.length, 2);
});

test('pause freezes the countdown; resume carries on with the time that was left', () => {
  const g = newGame(['A', 'B']);
  const d = g.state.timer!.deadline!;
  const pausedAt = d - 12_000;
  let r = apply(g.state, HOST, { type: 'pause' }, pausedAt);
  assert.ok(r.ok); if (r.ok) g.state = r.state;
  assert.equal(g.state.timer!.deadline, null);
  assert.equal(g.state.timer!.remainingMs, 12_000);
  r = apply(g.state, HOST, { type: 'resume' }, pausedAt + 600_000);
  assert.ok(r.ok); if (r.ok) g.state = r.state;
  assert.equal(g.state.timer!.deadline, pausedAt + 600_000 + 12_000);
});

test('the host can choose no timers', () => {
  const g = newGame(['A', 'B'], { answerSeconds: 0 });
  assert.equal(g.state.timer, null);
  g.confirm(3);
  assert.equal(g.state.timer, null);
});

test('Pass: the host moves on when the player passes — zero points, Wild given back', () => {
  const g = newGame(['A', 'B']);
  g.wild('A');
  g.do(HOST, { type: 'reject', reason: 'pass', turnSerial: g.serial });
  assert.equal(g.turnPlayer, 'B');
  assert.equal(g.state.attempts[0].outcome, 'passed');
  assert.equal(g.score('A'), 0);
  assert.equal(g.card('A').wild, 'available');
  g.fail(P('B'), { type: 'reject', reason: 'pass', turnSerial: g.serial }, 'NOT_HOST');
});

test('passing on the Streak extra answer counts as failing it', () => {
  const g = newGame(['A', 'B']);
  g.confirm(7);
  g.streak('A');
  g.do(HOST, { type: 'reject', reason: 'pass', turnSerial: g.serial });
  assert.equal(g.score('A'), 0);
});
