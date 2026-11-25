import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, createGame } from '../src/engine.ts';
import { buildView } from '../src/views.ts';
import { Game, HOST, P, content, qid } from './helpers.ts';

function oneMasterGame(names = ['A', 'B', 'C']) {
  const g = new Game(createGame({ now: 0, config: { hostOnly: true }, categories: ['geography'] }));
  for (const n of names) g.do(HOST, { type: 'join', playerId: n, name: n });
  g.do(HOST, { type: 'start', questionIds: Array.from({ length: 20 }, (_, i) => qid(i + 1)) });
  return g;
}

test('host-only game: the host adds players by name', () => {
  const g = oneMasterGame();
  assert.deepEqual(g.state.players.map((p) => p.name), ['A', 'B', 'C']);
});

test('normal game: the host still cannot add players or use their cards', () => {
  const s = createGame({ now: 0 });
  const r = apply(s, HOST, { type: 'join', playerId: 'X', name: 'X' }, 1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'NOT_PLAYER');
});

test('host-only game: the host plays Wild for whoever is on turn', () => {
  const g = oneMasterGame();
  assert.equal(g.turnPlayer, 'A');
  g.do(HOST, { type: 'activate_wild', turnSerial: g.serial });
  assert.equal(g.card('A').wild, 'armed');
  g.confirm(3);
  assert.equal(g.score('A'), 15);
  assert.equal(g.card('A').wild, 'used');
  assert.equal(g.card('B').wild, 'available');
});

test('host-only game: the host plays Streak for whoever is on turn', () => {
  const g = oneMasterGame();
  g.confirm(2); // A claims rank 2 → Streak offered
  assert.equal(g.round.turn?.awaitingStreakDecision, true);
  g.do(HOST, { type: 'activate_streak', turnSerial: g.serial });
  assert.equal(g.card('A').streak, 'used');
  assert.equal(g.round.turn?.attemptNo, 2);
  g.confirm(5);
  assert.equal(g.score('A'), 7);
  assert.equal(g.turnPlayer, 'B');
});

test('host-only flag reaches the view', () => {
  const g = oneMasterGame();
  assert.equal(buildView(g.state, content(), { role: 'host' }).hostOnly, true);
  const normal = new Game(createGame({ now: 0 }));
  normal.do(P('A'), { type: 'join', playerId: 'A', name: 'A' });
  assert.equal(buildView(normal.state, content(), { role: 'host' }).hostOnly, false);
});
