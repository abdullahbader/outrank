# 02 — Architecture

## 1. Shape

| Part | Tech | Role |
|---|---|---|
| `apps/mobile` | Expo (React Native) + TypeScript | One app, two roles: Host and Player. iOS, Android, and web (for testing) |
| `apps/api` | NestJS + Prisma + PostgreSQL + Socket.IO | Rooms, the game engine runner, question selection, event log, live updates |
| `packages/shared` | Plain TypeScript, no dependencies | **Game engine** (rules, scoring, cards, turns, endgame), question selection, views, schemas |
| `packages/i18n` | JSON | Every visible string, `en.json` + `ar.json` |
| `content/` | JSON + import script | Question dataset (TEST DATA now, owner's list later) and its validator |

There is no admin dashboard in v1: the brief forbids question editors, and questions enter through
the importer. A read-only content and games dashboard can be added later without engine changes.

## 2. Why NestJS + Socket.IO and not Supabase

The brief invites an evaluation of Supabase. Chosen instead: the owner's standard stack.
- **Runs entirely on the PC**: no cloud account or keys to build and demo.
- **One authoritative engine**: every action goes through one server function inside a database
  transaction holding a row lock on the game. Races (two hosts' taps, double taps, two card taps)
  are serialised by the lock and rejected by the engine's state checks.
- **Rooms map 1:1 to Socket.IO rooms**, with per-socket filtering so a player's socket never receives
  host-only data. With Supabase Realtime, hiding unclaimed answers needs careful row-level security on
  every broadcast table; here it is one projection function, unit-tested.
- Hosting stays open: it is plain PostgreSQL + a Node server (Railway, Fly, Render, or Supabase's
  Postgres as just the database).

## 3. The game engine (packages/shared)

`apply(state, actor, action, now) → { ok, state, events } | { ok: false, error }`

- **Pure and deterministic.** No I/O, no clock, no randomness inside (the server passes `now` and the
  shuffled question list). The same function runs in unit tests and on the server.
- **Actor-checked.** Host-only actions, player-only card actions, "only on your own turn".
- **Stale-proof.** Every answer-related action carries the `turnSerial` it was made for. A double tap
  or a late duplicate arrives with an old serial and is rejected (`STALE_TURN`).
- **Scores are derived**, never typed in: a player's score is the sum of their non-voided,
  non-cancelled attempts. Corrections can therefore never leave a score out of step with the answers.
- **Views.** `hostView` and `playerView` turn the state + question content into what each phone may
  see. `playerView` only contains the text of claimed answers until the question is over.

Clients never compute points. They show what the server sends and animate the change.

## 4. Server flow for one action

```
socket "action" {gameId, clientActionId, action}
  → auth: device token → actor (host of this game? player in it?)
  → BEGIN; SELECT game FOR UPDATE
  → idempotency: (gameId, clientActionId) seen? → return stored result
  → engine.apply(state, actor, action, now)
  → save state (version+1), append events (seq), store action result
  → COMMIT
  → broadcast per socket: hostView to host sockets, playerView(viewerId) to each player socket
```

## 5. Realtime and reconnection

- Every broadcast carries the game `version`. A phone that misses one (or reconnects) asks for the
  current snapshot; it never applies a diff on an older version. "Restore the latest valid state" is
  therefore always one call.
- Sockets reconnect automatically; on reconnect the phone re-joins its room with its device token and
  receives a fresh snapshot. Backgrounding the app is the same path.
- **Host disconnect:** after a grace period (setting, default 20 s) the server pauses the game and
  players see "Waiting for the host". The host's phone keeps the host token; reopening the app
  returns to the same game. A host can also hand off to another phone with a host recovery code shown
  in the host menu.
- **Player disconnect:** shown as "offline" on the board. The host can wait or skip their turn.
- Nothing is reset on reconnect. The event log (`game_events`) lets any game be reconstructed.

## 6. Identity and security

- First launch: `POST /devices` → device id + secret token (kept in SecureStore). No sign-up.
- Joining a room: code + display name → participant record linked to the device.
- Room codes: 6 characters from an unambiguous alphabet (no 0/O/1/I), unique among open games.
- Rate limits on join attempts per device and per IP.
- The host token is the device that created the game (or the recovery code holder).

## 7. Testing approach

- Engine: Node's built-in test runner on the pure engine — every rule and the 22 edge cases.
- API: end-to-end smoke suite against an **isolated test database**: full game with bots, races,
  double submits, wrong role, hidden-answer leak checks on every player payload, reconnects.
- App: browser pane at phone size in both languages, plus the owner's Android phone (Expo Go).
- **Bot players** (dev only): fill a room with virtual players from the PC so one person can test.
