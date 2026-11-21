# 05 — Game Flow and State Machine

## Phases

```
lobby ──start──▶ question ──(everyone had a turn | 12 claimed)──▶ results ──next_question──┐
                    ▲                                               │                       │
                    └───────────── next regular or tie-breaker ◀────┘                       ▼
                                                                                        finished
pause/resume can wrap any playing phase; end_game jumps to finished from anywhere.
```

## A turn

```
answer awaited (attempt 1)          player may switch on Wild
   ├─ host taps rank r (unclaimed) → claim r, points = base(r) × (Wild? 5 : 1)
   │     ├─ Streak available and answers remain → Streak decision
   │     │     ├─ player taps Use Streak → answer awaited (attempt 2), may switch on Wild if unused
   │     │     │     ├─ correct → claim, add points, turn ends
   │     │     │     └─ wrong / claimed / skipped → cancel attempt-1 points (answer stays claimed), turn ends
   │     │     └─ player taps Done / host taps Next player → turn ends
   │     └─ otherwise → turn ends
   ├─ host taps Wrong / Already claimed → 0 points (Wild used up if on), turn ends
   └─ host taps Skip → 0 points (Wild returned), turn ends
```

## Scoring table (the only one)

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | **+20** | **−11** | **−12** |

Wild multiplies by 5 (negative too: rank 11 → −55).

## End of a question

1. Reveal the full ranking to everyone.
2. Rotate the order: the first player moves to the end.
3. Decide what is next:
   - endgame not triggered → next regular question;
   - endgame triggered (someone reached 100 at any point) or this was a tie-breaker → among the
     contenders (everyone, or the tie-breaker's players) take the top score: one player → **winner**;
     several → **tie-breaker** with only them;
   - no questions left → finished on current scores (tied top players share the win).
4. The host taps Continue. Results stay on screen until then, so the host can still fix mistakes.

## Corrections

`void_attempt` marks an answer void: its points and claim disappear, Wild/Streak it used come back,
a Streak failure it caused is undone, and the endgame trigger is re-checked if that answer caused it.
With `replayTurn` (only for the most recent answer of the current question) the turn goes back to
that player. Every correction is an event in the audit log with the host as actor.
