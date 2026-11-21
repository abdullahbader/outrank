# 06 — Game Engine and Scoring (technical reference)

Code: `packages/shared/src`. Tests: `packages/shared/test` (`npm test -w @outrank/shared`).

| File | What it holds |
|---|---|
| `scoring.ts` | The scoring table (`basePoints`), `pointsFor(rank, multiplier)`, `rotate` |
| `engine.ts` | `createGame`, `apply(state, actor, action, now)`, `decide` (what follows a question) |
| `views.ts` | `buildView(state, questions, viewer)` — host view / player view, `leaderboard`, `finalSummary` |
| `selection.ts` | `selectQuestions(pool, categories, count, rng)`, `mulberry32`, `countAvailable` |
| `types.ts` | State, actions, errors, events |

## Rules as implemented

- **Points** come only from `basePoints` × multiplier. A player's score is recomputed from their
  attempts after every change (`recomputeScores`): the sum of `points` over attempts that are correct,
  not voided and not cancelled by a failed Streak.
- **Claiming**: `round.claimed[rank] = attemptId`. `confirm` on a claimed rank fails with
  `ALREADY_CLAIMED`; the host then uses `reject(already_claimed)`.
- **Turn guard**: `turnSerial` increases whenever a new attempt can begin (new turn, Streak second
  attempt, replay, question end). Host rulings and card taps must quote the current serial.
- **Wild**: `available → armed` (own turn, answer awaited) → `used` when the answer is ruled (×5 if
  correct). Back to `available` if the turn is skipped or the answer is voided.
- **Streak**: offered (`awaitingStreakDecision`) after a correct first answer while Streak is unused and
  answers remain. `activate_streak` → attempt 2. A failed attempt 2 (wrong, already claimed, skipped)
  sets `cancelledByStreak` on attempt 1.
- **Question end**: `positivesLeft(round) === 0` (ranks 1–10 all claimed) or the host's `end_question`.
  Until then turns cycle: the player for turn index *i* is `participants[i % participants.length]`.
  Rotation for the next question = rotate(rotation at question start).
- **Endgame**: set once any score ≥ target (`endgame.byAttemptId` records the cause). Voiding that
  exact answer re-checks it.
- **Next step** (`decide`): see docs/05 §"End of a question".
- **Corrections** (`void_attempt`): see docs/05 §"Corrections".

## Changing a rule later

Every default in docs/01 §3 is one branch in `engine.ts` with a test named after it. Change the
branch, update the test, and all screens follow, because they only render the views.

## Replacing the question database

The engine only knows question **ids**. Content (titles, answers, aliases, sources) lives in the
database and is joined in `buildView`. See docs/10 (question data) once stage D lands.
