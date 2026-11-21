# 08 — Build Plan

Stages run back to back. Each ends with tests passing and a commit.

| Stage | Delivers | Brief §§ |
|---|---|---|
| **A. Docs** ✅ | Requirements and defaults, architecture, data model, API, game flow, edge cases, this plan | 17.1 |
| **B. Game engine** ✅ | `packages/shared`: scoring, turns, rotation, claims, Wild, Streak, endgame, tie-breakers, corrections, pause, views (hidden answers), question selection; unit tests for every rule and edge case | 5–7, 9B, 15, 16 |
| **C. API** ✅ | NestJS + Prisma + Socket.IO: devices, rooms and codes, join, lobby, start with automatic selection, actions with row lock + idempotency, event log, broadcasts per role, reconnect, host pause/recovery, results and stats, bots; smoke suite on an isolated DB | 4, 12–14 |
| **D. Question set** | `content/`: ≥30 TEST DATA questions in 10 categories, 12 ranked answers each, aliases, sources, ranking basis and date, EN + AR; importer + validator; replacement guide | 9C–E |
| **E. Mobile app** | Expo app: design system (dark party look), Welcome, Create, Join (code + QR), Lobby, Gameplay (host board + player screen), Leaderboard, Question results, Final results with celebration, Profile; AR/EN + RTL | 10, 11 |
| **F. Full play-through** | Bots + real phone, complete games incl. cards, ties, corrections, disconnects; fixes | 15, 16 |
| **G. Store prep** | Icons, splash, EAS config, permissions (camera for QR only), privacy policy draft, store text, deployment and setup docs | 17.7, 19 |

## Environment
- Node 24 + npm workspaces. The engine runs on Node's built-in TypeScript support and test runner, so
  it needs no packages.
- PostgreSQL 18 (already installed for cleno): a separate user-owned cluster for Outrank on its own
  port, so cleno's data is never touched.
