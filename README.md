# Outrank

A ranking trivia party game for iOS and Android: about 10 players in one room, one host, 12 ranked
answers per question, first to 100 points.

- `docs/` — requirements, architecture, data model, API, game flow, engine, edge cases, build plan
- `packages/shared` — the game engine (rules, scoring, cards, turns, endgame, views, question selection)

## Run the engine tests

```
npm test -w @outrank/shared
```

Needs Node 24 or newer (it runs TypeScript directly; no packages to install for the engine).

## Run everything locally

```powershell
npm install                 # once (also builds the game engine)
npm run db:start            # Outrank's own PostgreSQL on port 5436
npm run db:deploy           # create/update tables
npm run questions:import    # load the 30 TEST DATA questions
npm run api:dev             # API on http://localhost:3300
npm run app:web             # app in the browser on http://localhost:8091
npm run app:start           # Expo Go QR for your phone (same Wi-Fi; the app finds the API on this PC)
```

Checks: `npm test` (rules engine), `npm run smoke` (full multiplayer run on the isolated test database).

## Testing alone

- **As the host:** create a game, then "Add 9 test players" in the lobby (test builds only).
- **As a player:** on Home tap "Practise as a player" (test builds only). Test players and an
  automatic host play with you; on your turn a "Test host" panel lets you rule on your own answer
  (tap a rank or Wrong), so you can try Wild, Streak and every player screen from one phone.
- Both are switched off when `NODE_ENV=production` (the server refuses to start with them on).
