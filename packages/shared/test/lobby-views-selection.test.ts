import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.ts';
import { buildView } from '../src/views.ts';
import { countAvailable, mulberry32, selectQuestions } from '../src/selection.ts';
import { Game, HOST, P, content, newGame, qid } from './helpers.ts';

// ── lobby

test('lobby: join, unique names, remove, leave, limits', () => {
  const g = new Game(createGame({ now: 0, categories: ['geography'], config: { maxPlayers: 3 } }));
  g.do(P('a'), { type: 'join', playerId: 'a', name: '  Sara  ' });
  assert.equal(g.state.players[0].name, 'Sara');
  g.fail(P('b'), { type: 'join', playerId: 'b', name: 'sara' }, 'NAME_TAKEN');
  g.fail(P('b'), { type: 'join', playerId: 'b', name: '   ' }, 'NAME_INVALID');
  g.fail(P('b'), { type: 'join', playerId: 'b', name: 'x'.repeat(21) }, 'NAME_INVALID');
  g.fail(P('a'), { type: 'join', playerId: 'a', name: 'Other' }, 'ALREADY_JOINED');
  g.fail(P('b'), { type: 'join', playerId: 'c', name: 'Imposter' }, 'NOT_PLAYER');
  g.do(P('b'), { type: 'join', playerId: 'b', name: 'Omar' });
  g.do(P('c'), { type: 'join', playerId: 'c', name: 'Ali' });
  g.fail(P('d'), { type: 'join', playerId: 'd', name: 'Late' }, 'GAME_FULL');
  g.fail(P('a'), { type: 'remove_player', playerId: 'b' }, 'NOT_HOST');
  g.do(HOST, { type: 'remove_player', playerId: 'b' });
  g.do(P('c'), { type: 'leave' });
  assert.deepEqual(g.state.players.map((p) => p.name), ['Sara']);
});

test('start: needs players, categories and enough questions; list then fixed', () => {
  const g = new Game(createGame({ now: 0 }));
  g.do(P('a'), { type: 'join', playerId: 'a', name: 'A' });
  const ids = Array.from({ length: 15 }, (_, i) => qid(i + 1));
  g.fail(HOST, { type: 'start', questionIds: ids }, 'NO_CATEGORIES');
  g.do(HOST, { type: 'set_categories', categories: ['history', 'sports'] });
  g.fail(HOST, { type: 'start', questionIds: ids }, 'NOT_ENOUGH_PLAYERS');
  g.do(P('b'), { type: 'join', playerId: 'b', name: 'B' });
  g.fail(HOST, { type: 'start', questionIds: ids.slice(0, 14) }, 'NOT_ENOUGH_QUESTIONS');
  g.fail(HOST, { type: 'start', questionIds: [...ids.slice(0, 14), 'q1'] }, 'NOT_ENOUGH_QUESTIONS');
  g.fail(P('a'), { type: 'start', questionIds: ids }, 'NOT_HOST');
  g.do(HOST, { type: 'start', questionIds: ids });
  assert.equal(g.state.phase, 'question');
  g.fail(P('c'), { type: 'join', playerId: 'c', name: 'C' }, 'WRONG_PHASE');
  g.fail(HOST, { type: 'remove_player', playerId: 'a' }, 'WRONG_PHASE');
});

// ── views: hidden answers

function assertNoSecrets(view: unknown, allowed: Set<string>) {
  const json = JSON.stringify(view);
  const found = json.match(/SECRET-\d+-\d+/g) ?? [];
  for (const s of found) assert.ok(allowed.has(s), `player view leaked ${s}`);
  assert.ok(!json.includes('alias-'), 'aliases are host-only');
}

test('player view shows only claimed answers until the question ends; host sees all', () => {
  const qs = content();
  const g = newGame(['A', 'B', 'C']);
  const host = buildView(g.state, qs, { role: 'host' });
  assert.equal(host.round!.slots.filter((s) => s.text).length, 12);
  assertNoSecrets(buildView(g.state, qs, { role: 'player', playerId: 'B' }), new Set());

  g.answer(4);
  const v = buildView(g.state, qs, { role: 'player', playerId: 'B' });
  assertNoSecrets(v, new Set(['SECRET-1-4']));
  assert.equal(v.round!.slots.find((s) => s.rank === 4)!.claimedBy, 'A');
  assert.equal(v.round!.attempts[0].points, 4);

  g.answer(null); g.answer(7);
  g.endQ();
  const done = buildView(g.state, qs, { role: 'player', playerId: 'B' });
  assert.equal(done.round!.finished, true);
  assert.equal(done.round!.slots.filter((s) => s.text).length, 12, 'full ranking revealed at the end');
});

test('a voided answer does not leak to players', () => {
  const qs = content();
  const g = newGame(['A', 'B', 'C']);
  g.answer(10);
  g.do(HOST, { type: 'void_attempt', attemptId: g.state.attempts[0].id, replayTurn: false });
  const v = buildView(g.state, qs, { role: 'player', playerId: 'C' });
  assertNoSecrets(v, new Set());
  assert.equal(v.round!.attempts[0].rank, null);
});

test('never leaks across a whole game with cards and corrections', () => {
  const qs = content();
  const g = newGame(['A', 'B', 'C', 'D']);
  const check = () => {
    const r = g.round;
    const allowed = new Set(Object.keys(r.claimed).map((rank) => `SECRET-${r.questionId.slice(1)}-${rank}`));
    for (const id of ['A', 'B', 'C', 'D']) {
      const v = buildView(g.state, qs, { role: 'player', playerId: id });
      if (!r.finished) assertNoSecrets(v, allowed);
    }
  };
  for (let q = 0; q < 5 && g.state.phase !== 'finished'; q++) {
    let rank = 1;
    while (g.state.phase === 'question') {
      const pid = g.turnPlayer!;
      if (g.card(pid).wild === 'available' && rank % 3 === 0) g.wild(pid);
      g.confirm(rank++);
      check();
      if (g.round.turn?.awaitingStreakDecision) {
        if (g.card(pid).streak === 'available' && rank % 2 === 0) { g.streak(pid); g.wrong(); } else g.done();
      }
      check();
    }
    if (g.state.phase === 'results') g.next();
  }
});

test('view shows the lap and who is next, wrapping round the table', () => {
  const g = newGame(['A', 'B', 'C']);
  g.answer(1); g.answer(2);
  let v = buildView(g.state, content(), { role: 'host' });
  assert.equal(v.round!.nextPlayerId, 'A', 'after C comes A again');
  assert.equal(v.round!.lap, 1);
  g.answer(3);
  v = buildView(g.state, content(), { role: 'host' });
  assert.equal(v.round!.lap, 2);
  assert.equal(v.round!.positivesLeft, 7);
});

test('leaderboard: positions with ties, last-question deltas, my cards', () => {
  const qs = content();
  const g = newGame(['A', 'B', 'C']);
  g.answer(5); g.answer(3); g.answer(null);
  g.endQ();
  g.next(); // order B C A
  g.answer(2); // B 3+2 = 5
  const v = buildView(g.state, qs, { role: 'player', playerId: 'C' });
  assert.deepEqual(v.leaderboard.map((r) => [r.name, r.score, r.position]), [['A', 5, 1], ['B', 5, 1], ['C', 0, 3]]);
  assert.equal(v.leaderboard.find((r) => r.id === 'B')!.lastDelta, 2);
  assert.equal(v.me!.isMyTurn, true);
  assert.equal(v.me!.canActivateWild, true);
  assert.equal(v.me!.canActivateStreak, false);
});

test('final summary has winner, positions and per-player stats', () => {
  const g = newGame(['A', 'B'], { targetScore: 20 });
  g.wild('A'); g.answer(10);  // A 100
  g.confirm(11); g.streak('B'); g.confirm(1); // B −11 + 1 = −10
  g.endQ();
  g.next();
  const v = buildView(g.state, content(), { role: 'host' });
  assert.equal(v.summary!.winnerIds[0], 'A');
  const b = v.summary!.players.find((p) => p.id === 'B')!;
  assert.equal(b.answersClaimed, 2);
  assert.equal(b.pointsGained, 1);
  assert.equal(b.pointsLost, 11);
  assert.deepEqual(b.cardsUsed, ['streak']);
});

// ── selection

const pool = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, categoryId: 'geography' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `h${i}`, categoryId: 'history' })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, categoryId: 'sports' })),
];

test('selection: only chosen categories, no duplicates, balanced, reproducible', () => {
  const ids = selectQuestions(pool, ['geography', 'history'], 8, mulberry32(7));
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.ok(ids.every((id) => id.startsWith('g') || id.startsWith('h')));
  const h = ids.filter((id) => id.startsWith('h')).length;
  assert.equal(h, 4, 'balanced: history gets its fair share');
  assert.deepEqual(ids, selectQuestions(pool, ['geography', 'history'], 8, mulberry32(7)));
  assert.notDeepEqual(ids, selectQuestions(pool, ['geography', 'history'], 8, mulberry32(8)));
});

test('selection: smaller pool returns what exists; count helper', () => {
  assert.equal(selectQuestions(pool, ['history'], 50, mulberry32(1)).length, 4);
  assert.equal(countAvailable(pool, ['history', 'sports']), 10);
  assert.equal(selectQuestions([...pool, { id: 'g1', categoryId: 'geography' }], ['geography'], 50, mulberry32(1)).length, 10);
});
