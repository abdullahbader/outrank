// End-to-end smoke suite. Runs the real API against the ISOLATED test database (outrank_test),
// never the demo data. Usage: npm run smoke -w @outrank/api   (build first: npm run build -w @outrank/api)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { io } = require('socket.io-client');

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '../../../.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const DB = env.DATABASE_URL_TEST;
if (!DB || !/\/outrank_test(\?|$)/.test(DB)) { console.error('Refusing: DATABASE_URL_TEST must point at outrank_test'); process.exit(1); }

const PORT = 3399;
const BASE = `http://127.0.0.1:${PORT}`;
const GRACE = 1500;
const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

let passed = 0, failed = 0;
const stage = (name) => console.log(`\n▶ ${name}`);
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✔ ${msg}`); } else { failed++; console.log(`  ✖ ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── fresh test data
async function resetAndSeed() {
  await prisma.$executeRawUnsafe('TRUNCATE game_results, game_actions, game_events, game_questions, game_participants, games, devices, question_sources, question_answers, questions, categories RESTART IDENTITY CASCADE');
  await prisma.category.createMany({ data: [
    { id: 'geography', nameEn: 'Geography', nameAr: 'جغرافيا', sort: 1 },
    { id: 'history', nameEn: 'History', nameAr: 'تاريخ', sort: 2 },
    { id: 'empty', nameEn: 'Empty', nameAr: 'فارغة', sort: 3 },
  ] });
  for (let i = 1; i <= 24; i++) {
    const id = `t${i}`;
    await prisma.question.create({ data: {
      id, categoryId: i % 2 ? 'geography' : 'history', titleEn: `Test question ${i}`, titleAr: `سؤال ${i}`,
      status: 'active', verification: i === 24 ? 'unverified' : 'verified', dataset: 'SMOKE',
      answers: { create: Array.from({ length: 12 }, (_, k) => ({ rank: k + 1, textEn: `SECRET-${id}-${k + 1}`, aliases: [`ALIAS-${id}-${k + 1}`] })) },
      sources: { create: [{ label: 'smoke' }] },
    } });
  }
}

// ── helpers
async function http(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Device ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function device(name) {
  const r = await http('POST', '/devices', null, name ? { displayName: name } : {});
  return r.body.token;
}

/** A connected phone. Records every payload it receives so we can scan them for leaks. */
function phone(token, label) {
  const socket = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  const p = { label, token, socket, payloads: [], view: null, version: 0 };
  socket.on('game:state', (m) => { p.payloads.push(JSON.stringify(m)); if (m.version >= p.version) { p.version = m.version; p.view = m.view; } });
  p.ready = new Promise((r) => socket.on('connect', r));
  p.emit = (ev, body) => new Promise((r) => socket.timeout(5000).emit(ev, body, (err, res) => r(err ? { ok: false, error: 'TIMEOUT' } : res)));
  p.subscribe = async (gameId) => {
    const r = await p.emit('game:subscribe', { gameId });
    if (r.ok) { p.payloads.push(JSON.stringify(r)); p.view = r.view; p.version = r.version; }
    return r;
  };
  p.act = (gameId, action, clientActionId = randomUUID()) => p.emit('game:action', { gameId, clientActionId, action });
  p.waitFor = async (pred, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (p.view && pred(p.view)) return true; await sleep(25); }
    return false;
  };
  return p;
}

/** Secrets a player may legitimately have seen: claimed answers of unfinished questions, all answers of finished ones. */
async function leakScan(gameId, players) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  const s = game.state;
  let leaks = 0;
  for (const p of players) {
    for (const raw of p.payloads) {
      const msg = JSON.parse(raw);
      const v = msg.view;
      if (!v?.round) continue;
      const allowed = new Set(v.round.slots.filter((x) => x.claimedBy || v.round.finished).map((x) => `SECRET-${v.round.questionId}-${x.rank}`));
      for (const hit of raw.match(/SECRET-t\d+-\d+/g) ?? []) if (!allowed.has(hit)) leaks++;
      if (raw.includes('ALIAS-')) leaks++;
    }
  }
  return { leaks, rounds: s.rounds.length };
}

// ── run
async function main() {
  await resetAndSeed();
  const api = spawn(process.execPath, [join(here, '../dist/main.js')], {
    env: { ...process.env, DATABASE_URL: DB, PORT: String(PORT), NODE_ENV: 'test', DEV_TOOLS: 'true', HOST_GRACE_MS: String(GRACE), GAME_MIN_QUESTIONS: '6', GAME_TARGET_SCORE: '40', JOIN_ATTEMPTS_PER_MINUTE: '200' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiLog = '';
  api.stdout.on('data', (d) => (apiLog += d));
  api.stderr.on('data', (d) => (apiLog += d));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + '/health')).ok) break; } catch {} await sleep(150); }

  try {
    stage('1. Identity and categories');
    const hostToken = await device('Host');
    check(!!hostToken, 'guest device created without sign-up');
    check((await http('GET', '/devices/me', 'bogus')).status === 401, 'unknown device token is refused');
    const cats = (await http('GET', '/categories')).body;
    check(cats.find((c) => c.id === 'geography')?.ready === 12 && cats.find((c) => c.id === 'history')?.ready === 11, 'category counts only include verified, active questions');

    stage('2. Create room and lobby');
    const created = (await http('POST', '/games', hostToken, { categories: ['geography', 'history'] })).body;
    check(/^[A-HJ-NP-Z2-9]{6}$/.test(created.code), `room code ${created.code} uses the unambiguous alphabet`);
    const gameId = created.gameId;
    const preview = (await http('GET', `/games/by-code/${created.code.toLowerCase()}`, hostToken)).body;
    check(preview.gameId === gameId && preview.playerCount === 0, 'lobby preview by code (case-insensitive)');
    check((await http('POST', `/games/${gameId}/join`, hostToken, { name: 'Me' })).body.error === 'HOST_CANNOT_JOIN', 'the host is not a player');

    const names = ['Ahmed', 'Omar', 'Sara', 'Ali', 'Lina'];
    const tokens = [];
    for (const n of names) {
      const t = await device();
      const r = await http('POST', `/games/${gameId}/join`, t, { name: n });
      check(r.status === 200 && r.body.playerId, `${n} joins`);
      tokens.push(t);
    }
    const dupe = await device();
    check((await http('POST', `/games/${gameId}/join`, dupe, { name: 'sara' })).body.error === 'NAME_TAKEN', 'names are unique (case-insensitive)');
    const again = await http('POST', `/games/${gameId}/join`, tokens[0], { name: 'Ahmed' });
    check(again.body.rejoined === true, 'joining twice from the same phone returns the same player');

    const host = phone(hostToken, 'host');
    const players = tokens.map((t, i) => phone(t, names[i]));
    await Promise.all([host.ready, ...players.map((p) => p.ready)]);
    check((await host.subscribe(gameId)).ok, 'host subscribes');
    for (const p of players) check((await p.subscribe(gameId)).ok && p.view.role === 'player', `${p.label} subscribes as player`);
    const outsider = phone(dupe, 'outsider');
    await outsider.ready;
    check((await outsider.subscribe(gameId)).error === 'NOT_IN_GAME', 'a phone not in the game cannot watch it');

    const lina = players[4];
    const linaId = lina.view.me.playerId;
    check((await players[0].act(gameId, { type: 'remove_player', playerId: linaId })).error === 'NOT_HOST', 'players cannot remove players');
    check((await host.act(gameId, { type: 'remove_player', playerId: linaId })).ok, 'host removes a player before the start');
    check(await host.waitFor((v) => v.players.length === 4), 'lobby updates for the host');
    check((await lina.act(gameId, { type: 'leave' })).error === 'NOT_IN_GAME', 'removed player is out');
    players.pop();

    stage('3. Start with automatic question selection');
    check((await host.act(gameId, { type: 'set_categories', categories: ['empty'] })).ok, 'host picks categories');
    check((await host.act(gameId, { type: 'start' })).error === 'NOT_ENOUGH_QUESTIONS', 'a category without enough ready questions cannot start');
    await host.act(gameId, { type: 'set_categories', categories: ['geography', 'history'] });
    check((await players[0].act(gameId, { type: 'start' })).error === 'NOT_HOST', 'only the host starts');
    check((await host.act(gameId, { type: 'start' })).ok, 'host starts the game');
    const prepared = await prisma.gameQuestion.findMany({ where: { gameId } });
    check(prepared.length === 23 && new Set(prepared.map((q) => q.questionId)).size === 23, 'all 23 ready questions prepared, no duplicates');
    check(!prepared.some((q) => q.questionId === 't24'), 'unverified question never selected');
    check(await players[0].waitFor((v) => v.phase === 'question'), 'players see the first question');
    check((await http('POST', `/games/${gameId}/join`, await device(), { name: 'Late' })).body.error === 'WRONG_PHASE', 'no joining after the start');

    const [ahmed, omar, sara, ali] = players;
    const pid = (p) => p.view.me.playerId;
    const turnOf = () => players.find((p) => pid(p) === host.view.round.turn?.playerId);
    const serial = () => host.view.turnSerial;
    const sync = async () => { const v = host.version; await Promise.all(players.map((p) => p.waitFor((x) => x && p.version >= v))); };

    stage('4. Turns, roles and scoring');
    check(turnOf() === ahmed, 'Ahmed starts (join order)');
    check((await ahmed.act(gameId, { type: 'confirm', rank: 1, turnSerial: serial() })).error === 'NOT_HOST', 'players cannot confirm answers');
    check((await host.act(gameId, { type: 'activate_wild', turnSerial: serial() })).error === 'NOT_PLAYER', 'host cannot use a player\'s card');
    check((await omar.act(gameId, { type: 'activate_wild', turnSerial: serial() })).error === 'NOT_YOUR_TURN', 'cards only on your own turn');
    check(host.view.round.slots.every((s) => s.text), 'host sees all 12 answers');
    check(ahmed.view.round.slots.every((s) => s.text === null), 'players see no answer before it is claimed');

    check((await ahmed.act(gameId, { type: 'activate_wild', turnSerial: serial() })).ok, 'Ahmed switches on Wild from his phone');
    await host.waitFor((v) => v.cardLog.length === 1);
    check(host.view.cardLog[0]?.card === 'wild', 'host sees the card activation');
    check((await host.act(gameId, { type: 'confirm', rank: 5, turnSerial: serial() })).ok, 'host confirms rank 5');
    await sync();
    check(omar.view.leaderboard.find((r) => r.id === pid(ahmed))?.score === 25, 'everyone sees Ahmed at 25 (5 × Wild)');
    const slot5 = omar.view.round.slots.find((s) => s.rank === 5);
    check(slot5.text?.en === `SECRET-${omar.view.round.questionId}-5` && slot5.claimedBy === pid(ahmed), 'claimed answer and its rank shown to players');
    check(host.view.round.turn.awaitingStreakDecision, 'Streak is offered after a correct answer');
    check((await ahmed.act(gameId, { type: 'end_turn', turnSerial: serial() })).ok, 'Ahmed taps Done');

    stage('5. Races and duplicates');
    await host.waitFor((v) => v.round.turn?.playerId === pid(omar));
    const s1 = serial();
    const [r1, r2] = await Promise.all([
      host.act(gameId, { type: 'confirm', rank: 7, turnSerial: s1 }),
      host.act(gameId, { type: 'confirm', rank: 8, turnSerial: s1 }),
    ]);
    check([r1, r2].filter((r) => r.ok).length === 1 && [r1, r2].some((r) => r.error === 'STALE_TURN'), 'two confirms at once: exactly one applied');
    await host.waitFor((v) => v.round.turn?.awaitingStreakDecision);
    await host.act(gameId, { type: 'end_turn', turnSerial: serial() });
    await host.waitFor((v) => v.round.turn?.playerId === pid(sara));
    const cid = randomUUID();
    const s2 = serial();
    const [d1, d2] = await Promise.all([
      host.act(gameId, { type: 'reject', reason: 'incorrect', turnSerial: s2 }, cid),
      host.act(gameId, { type: 'reject', reason: 'incorrect', turnSerial: s2 }, cid),
    ]);
    check(d1.ok && d2.ok && d1.version === d2.version, 'same request sent twice → same result, applied once');
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    check(game.state.attempts.filter((a) => a.playerId === pid(sara)).length === 1, 'only one attempt recorded for Sara');
    await host.waitFor((v) => v.round.turn?.playerId === pid(ali));
    const s3 = serial();
    const [w1, w2] = await Promise.all([
      ali.act(gameId, { type: 'activate_wild', turnSerial: s3 }),
      ali.act(gameId, { type: 'activate_wild', turnSerial: s3 }),
    ]);
    check([w1, w2].filter((r) => r.ok).length === 1 && [w1, w2].some((r) => r.error === 'CARD_USED'), 'double tap on a card uses it once');
    check((await host.act(gameId, { type: 'confirm', rank: 5, turnSerial: serial() })).error === 'ALREADY_CLAIMED', 'claimed answer cannot be awarded again');
    check((await host.act(gameId, { type: 'confirm', rank: 11, turnSerial: serial() })).ok, 'Ali: rank 11 with Wild');
    await sync();
    check(sara.view.leaderboard.find((r) => r.id === pid(ali)).score === -55, 'Wild on a negative answer: −55');
    check((await ali.act(gameId, { type: 'end_turn', turnSerial: serial() })).ok, 'Ali declines Streak');
    await sync();
    check(host.view.phase === 'question' && host.view.round.turn?.playerId === pid(ahmed), 'after one lap the turn comes back to Ahmed');
    check((await ahmed.act(gameId, { type: 'end_question' })).error === 'NOT_HOST', 'only the host can end a question');
    check((await host.act(gameId, { type: 'end_question' })).ok, 'host ends the question');
    await sync();
    check(host.view.phase === 'results', 'question is over');
    check(ahmed.view.round.slots.every((s) => s.text), 'full ranking revealed to players at the end');
    check(host.view.nextStarter === pid(omar), 'next question starts with Omar (rotation)');

    stage('6. Corrections');
    const lastAli = (await prisma.game.findUnique({ where: { id: gameId } })).state.attempts.at(-1);
    check((await omar.act(gameId, { type: 'void_attempt', attemptId: lastAli.id, replayTurn: true })).error === 'NOT_HOST', 'players cannot correct');
    check((await host.act(gameId, { type: 'void_attempt', attemptId: lastAli.id, replayTurn: true })).ok, 'host voids Ali\'s answer and gives the turn back');
    await sync();
    check(ali.view.leaderboard.find((r) => r.id === pid(ali)).score === 0 && ali.view.me.wild === 'available', 'points removed and Wild returned');
    check(ali.view.me.isMyTurn && ali.view.phase === 'question', 'question reopened on Ali\'s turn');
    const audit = await prisma.gameEvent.findMany({ where: { gameId, type: 'attempt_voided' } });
    check(audit.length === 1 && audit[0].actor === 'host', 'correction written to the audit log');
    await host.act(gameId, { type: 'confirm', rank: 2, turnSerial: serial() });
    await host.waitFor((v) => v.round.turn?.awaitingStreakDecision);
    check((await ali.act(gameId, { type: 'activate_streak', turnSerial: serial() })).ok, 'Ali uses Streak');
    await host.waitFor((v) => v.round.turn?.attemptNo === 2);
    await host.act(gameId, { type: 'reject', reason: 'incorrect', turnSerial: serial() });
    await sync();
    check(ali.view.leaderboard.find((r) => r.id === pid(ali)).score === 0, 'Streak failed: first answer\'s points lost');

    stage('7. Reconnecting');
    sara.socket.disconnect();
    if (host.view.phase === 'question') await host.act(gameId, { type: 'end_question' });
    await host.waitFor((v) => v.phase === 'results');
    await host.act(gameId, { type: 'next_question' });
    await sleep(200);
    const back = phone(sara.token, 'Sara-again');
    await back.ready;
    const snap = await back.subscribe(gameId);
    check(snap.ok && snap.version === host.version && snap.view.round.index === 1, 'reconnected phone gets the current state');
    players[2] = back;
    await host.waitFor((v) => v.online[pid(back)] === true);
    check(host.view.online[pid(back)] === true, 'host sees Sara back online');

    stage('8. Host drops → auto-pause → host returns');
    host.socket.disconnect();
    check(await back.waitFor((v) => v.paused === true, GRACE + 3000), 'game pauses itself after the grace period');
    check(back.view.hostOnline === false, 'players see the host is away');
    const host2 = phone(hostToken, 'host-again');
    await host2.ready;
    const hs = await host2.subscribe(gameId);
    check(hs.ok && hs.view.role === 'host' && hs.view.paused, 'host reopens the app: same game, still paused');
    check((await host2.act(gameId, { type: 'confirm', rank: 1, turnSerial: hs.view.turnSerial })).error === 'PAUSED', 'nothing happens while paused');
    check((await host2.act(gameId, { type: 'resume' })).ok, 'host resumes');

    stage('9. Host recovery to another phone');
    const newHostToken = await device('New host');
    check((await http('POST', `/games/${gameId}/host/recover`, newHostToken, { recoveryCode: 'WRONGCODE' })).status === 403, 'wrong recovery code refused');
    check((await http('POST', `/games/${gameId}/host/recover`, newHostToken, { recoveryCode: created.hostRecoveryCode })).body.ok, 'recovery code moves hosting to a new phone');
    host2.socket.disconnect();
    const H = phone(newHostToken, 'new-host');
    await H.ready;
    check((await H.subscribe(gameId)).view.role === 'host', 'new phone is the host');

    stage('10. Bots and playing to the end');
    const bots = await http('POST', `/dev/games/${gameId}/bots`, newHostToken, { count: 2 });
    check(bots.body.error === 'WRONG_PHASE', 'bots cannot be added after the start');
    let guard = 0;
    while (H.view.phase !== 'finished' && guard++ < 400) {
      const v = H.view;
      if (v.paused) { await H.act(gameId, { type: 'resume' }); }
      else if (v.phase === 'results') await H.act(gameId, { type: 'next_question' });
      else if (v.round.turn?.awaitingStreakDecision) await H.act(gameId, { type: 'end_turn', turnSerial: v.turnSerial });
      else {
        const open = v.round.slots.filter((s) => !s.claimedBy).map((s) => s.rank).filter((r) => r <= 10);
        const rank = open.includes(10) ? 10 : open.at(-1);
        await H.act(gameId, rank ? { type: 'confirm', rank, turnSerial: v.turnSerial } : { type: 'reject', reason: 'incorrect', turnSerial: v.turnSerial });
      }
      await H.waitFor((x) => x.version > v.version, 2000);
    }
    check(H.view.phase === 'finished', `game finished after ${H.view.questionsPlayed} questions`);
    check(H.view.outcome?.winnerIds.length === 1, 'exactly one winner');
    const results = await prisma.gameResult.findMany({ where: { gameId } });
    check(results.length === 4, 'results stored for every real player');
    const stats = (await http('GET', '/devices/me/stats', tokens[0])).body;
    check(stats.gamesPlayed === 1 && typeof stats.averageScore === 'number', 'profile stats count the game');
    const res = await http('GET', `/games/${gameId}/results`, tokens[1]);
    check(res.status === 200 && res.body.summary?.players.length === 4, 'final results available to players');

    stage('11. Hidden answers never reached a player');
    const scan = await leakScan(gameId, players);
    check(scan.leaks === 0, `0 leaks across ${players.reduce((n, p) => n + p.payloads.length, 0)} player payloads and ${scan.rounds} questions`);

    stage('12. Dev bots in a new lobby');
    const g2 = (await http('POST', '/games', hostToken, { categories: ['geography'] })).body;
    const added = await http('POST', `/dev/games/${g2.gameId}/bots`, hostToken, { count: 9 });
    check(added.body.added?.length === 9, '9 bot players fill a lobby');
    check((await http('POST', `/dev/games/${g2.gameId}/bots`, tokens[0], { count: 1 })).body.error === 'NOT_IN_GAME', 'only the host adds bots');
    const events = await prisma.gameEvent.count({ where: { gameId } });
    check(events > 30, `event history kept (${events} events)`);

    for (const p of [...players, H, outsider]) p.socket.disconnect();
  } catch (e) {
    failed++;
    console.error('\nSmoke run crashed:', e);
    console.error(apiLog.slice(-3000));
  } finally {
    api.kill();
    await prisma.$disconnect();
  }
  console.log(`\n${failed ? '✖' : '✔'} ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
