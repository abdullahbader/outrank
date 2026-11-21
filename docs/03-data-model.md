# 03 — Data Model

PostgreSQL via Prisma. The **game state** itself is one JSON document per game (the engine's state),
saved with a version number under a row lock. That keeps the rules in one place. The tables around
it hold what must be queried, joined, audited or imported.

## Content (independent of the engine)

| Table | Key columns | Notes |
|---|---|---|
| `categories` | `id` (slug, e.g. `geography`), `name_en`, `name_ar`, `sort`, `active` | Ten initial categories; more can be added by import |
| `questions` | `id` (stable string from the source file), `category_id`, `title_en`, `title_ar`, `difficulty` (1–3), `explanation_en/ar`, `ranking_basis` (what is measured and how), `as_of` (date the ranking refers to), `status` (`draft`/`active`/`retired`), `verification` (`unverified`/`verified`/`disputed`), `last_verified_at`, `dataset` (e.g. `TEST`), `version` | Only `active` + `verified` questions are selectable |
| `question_answers` | `question_id`, `rank` (1–12), `text_en`, `text_ar`, `aliases` (text[]), `value_note` (e.g. "17.1 M km²") | Unique `(question_id, rank)`; check `rank between 1 and 12` |
| `question_sources` | `question_id`, `label`, `url`, `accessed_at` | One or more per question |

An import is rejected unless every question has exactly ranks 1…12, no duplicate answer text or
alias inside the question, a category that exists, a ranking basis and at least one source.

## Identity and play

| Table | Key columns | Notes |
|---|---|---|
| `devices` | `id`, `token_hash`, `display_name`, `avatar_color`, `locale`, `created_at`, `last_seen_at` | Guest identity |
| `games` | `id`, `code` (6 chars), `host_device_id`, `status` (`lobby`/`playing`/`finished`/`abandoned`), `categories` (text[]), `state` (jsonb, engine state), `version`, `host_recovery_hash`, timestamps | Partial unique index on `code` where status ≠ finished/abandoned |
| `game_participants` | `game_id`, `player_id` (engine id), `device_id`, `display_name`, `joined_at`, `removed_at` | Unique `(game_id, device_id)` and `(game_id, lower(display_name))` for active participants |
| `game_questions` | `game_id`, `position`, `question_id` | The prepared, shuffled selection; unique `(game_id, question_id)` |
| `game_events` | `game_id`, `seq`, `type`, `actor`, `payload` (jsonb), `at` | Append-only; unique `(game_id, seq)`; the audit trail and replay source |
| `game_actions` | `game_id`, `client_action_id`, `result` (jsonb), `at` | Idempotency: unique `(game_id, client_action_id)` |
| `game_results` | `game_id`, `device_id`, `final_rank`, `final_score`, `won`, `answers_claimed`, `points_gained`, `points_lost`, `cards_used` | Written once on finish; feeds profile stats |

## Engine state (inside `games.state`)

```
status: lobby | playing | finished       paused: boolean
phase:  lobby | question | results | finished
players[]:   id, name, score (derived), wild (available|armed|used), streak (available|used)
rotation[]:  player ids — the order for the next question (first moves to the end after each question)
queue[]:     prepared question ids not yet played
rounds[]:    index, questionId, isTiebreak, participants[], turnIndex, turn, claimed{rank→attempt}, finished
turn:        playerId, attemptNo (1|2), awaitingStreakDecision, streakActive, firstAttemptId
attempts[]:  id, roundIndex, playerId, attemptNo, rank|null, outcome, basePoints, multiplier, points,
             cancelledByStreak, voided, at
cardLog[]:   playerId, card, roundIndex, at
endgame:     triggered, byAttemptId
nextStep:    next_question | tiebreak | finished (computed when a question ends)
tiedPlayerIds[], outcome { winnerIds[], reason }
turnSerial:  increases with every new attempt — stale-action guard
```

The brief's entity list maps as: users/profiles → `devices`; rooms/sessions → `games`; participants →
`game_participants`; selections → `game_questions`; answer attempts, claimed answers, scores, card
activations, turn order → engine state (+ `game_events`); events → `game_events`; final results →
`game_results`.
