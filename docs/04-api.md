# 04 — API and Live Events

REST for setup, Socket.IO for play. All requests carry `Authorization: Device <token>`.

## REST

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/devices` | anyone | Create guest identity → `{deviceId, token}` |
| PATCH | `/devices/me` | device | Display name, avatar colour, locale |
| GET | `/devices/me/stats` | device | Games played, won, win %, best, average, recent games |
| GET | `/categories` | device | Categories with count of ready questions |
| POST | `/games` | device (becomes host) | Create room → `{gameId, code, hostRecoveryCode}` |
| GET | `/games/by-code/:code` | device | Lobby preview before joining |
| POST | `/games/:id/join` | device | `{name}` → joins lobby as a player |
| POST | `/games/:id/host/recover` | device | `{recoveryCode}` → this device becomes host |
| GET | `/games/:id/state` | host or participant | Current snapshot (host view or player view) |
| GET | `/games/:id/results` | host or participant | Final results |
| POST | `/dev/games/:id/bots` | dev only | Add N bot players (refused when `NODE_ENV=production`) |

## Socket.IO

Client → server:
- `game:subscribe {gameId}` → server replies with a snapshot and keeps the socket in the room.
- `game:action {gameId, clientActionId, action}` → `{ok, version}` or `{ok:false, error}`.

Server → client:
- `game:state {version, view, events[]}` — the full view for that socket (host or player) plus the
  events that produced it (for animations: "Sara +7", "Wild ×5", "100 reached").

## Actions (the engine's vocabulary)

| Action | Actor | When |
|---|---|---|
| `set_categories {categories[]}` | host | lobby |
| `remove_player {playerId}` | host | lobby |
| `leave` | player | lobby |
| `start` | host | lobby; server prepares the question list first |
| `confirm {rank, turnSerial}` | host | answer awaited |
| `reject {reason: incorrect \| already_claimed, turnSerial}` | host | answer awaited |
| `skip_turn {turnSerial}` | host | answer awaited |
| `end_turn {turnSerial}` | host, or the current player | Streak decision pending |
| `activate_wild {turnSerial}` | current player | answer awaited, Wild available |
| `activate_streak {turnSerial}` | current player | Streak decision pending, Streak available |
| `void_attempt {attemptId, replayTurn}` | host | question or results phase |
| `end_question` | host | question phase — ends (skips) the current question now |
| `next_question` | host | results phase |
| `pause` / `resume` | host | playing |
| `end_game` | host | any time before finished |

`join` is performed by the server on `POST /games/:id/join` and goes through the engine too.

## Error codes

`NOT_HOST`, `NOT_PLAYER`, `NOT_YOUR_TURN`, `WRONG_PHASE`, `PAUSED`, `STALE_TURN`, `ALREADY_CLAIMED`,
`INVALID_RANK`, `CARD_USED`, `CARD_NOT_ALLOWED_NOW`, `NAME_TAKEN`, `NAME_INVALID`, `GAME_FULL`,
`NOT_ENOUGH_PLAYERS`, `NOT_ENOUGH_QUESTIONS`, `UNKNOWN_PLAYER`, `UNKNOWN_ATTEMPT`, `CANNOT_REPLAY`,
`GAME_FINISHED`.
