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
