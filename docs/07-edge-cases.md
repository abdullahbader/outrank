# 07 — Edge Cases (brief §15) and where they are tested

| # | Case | Expected | Test |
|---|---|---|---|
| 1 | Rank 1 answer | +1 | engine `scoring` |
| 2 | Rank 10 answer | +20 | engine `scoring` |
| 3 | Rank 11 answer | −11 | engine `scoring` |
| 4 | Rank 12 answer | −12 | engine `scoring` |
| 5 | Answer outside the top 12 | Host taps Wrong → 0, turn ends | engine `turns` |
| 6 | Already-claimed answer | Engine refuses to award (`ALREADY_CLAIMED`); host taps Already claimed → 0, turn ends | engine `claims` |
| 7 | Wild Card | rank 5 → 25, rank 10 → 100 | engine `cards` |
| 8 | Wild on a negative answer | rank 11 → −55 | engine `cards` |
| 9 | Streak, both correct | points for both | engine `cards` |
| 10 | Streak, second wrong | first answer's points cancelled, answer stays claimed | engine `cards` |
| 11 | Card used twice | `CARD_USED` | engine `cards` + API race |
| 12 | Two claims of the same answer at nearly the same time | One wins; the other is `STALE_TURN` / `ALREADY_CLAIMED` | engine + API race (parallel requests) |
| 13 | Someone reaches 100 mid-question | "100 reached" event, the question carries on until ranks 1–10 are claimed or the host ends it, no new regular question | engine `endgame` |
| 14 | Several reach 100 in one question | Highest final score wins | engine `endgame` |
| 15 | Tie for the top after the final question | Tie-breaker with tied players only | engine `endgame` |
| 16 | Tie-breaker still tied | Another tie-breaker; cards keep their state | engine `endgame` |
| 17 | Host confirms the wrong answer by mistake | `void_attempt` (+ replay) restores points, claim, cards; audited | engine `corrections` |
| 18 | Host disconnects mid-question | Auto-pause after grace period; host returns to same state | API smoke |
| 19 | Player disconnects on their turn | Host can skip; turn order intact | engine `turns` + API smoke |
| 20 | Player reconnects after missing events | Snapshot at current version | API smoke |
| 21 | Duplicate validation requests | Same `clientActionId` → same stored result; new id with old serial → `STALE_TURN` | engine + API |
| 22 | Pause and resume | All game actions refused while paused, state unchanged | engine `turns` |

Extra checks: player payloads never contain unclaimed answer text (every view in every test),
wrong-role actions, actions on another game, names taken, game full.
