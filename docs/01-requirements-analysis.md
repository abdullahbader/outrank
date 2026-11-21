# 01 — Requirements Analysis, Gaps & Assumptions

## 1. What the product really is

Outrank is not a quiz app. It is a **turn-based, host-refereed party game with a shared live
scoreboard**. The players are in the same room and give their answers out loud; the phones exist to
keep score, enforce the rules and make the moment exciting. The core chain is:

```
Host creates room ──▶ Players join (code / QR) ──▶ Host picks categories ──▶ Server prepares questions
                                                                                    │
         ┌──────────────────────────────── question loop ──────────────────────────┘
         ▼
  Current player says an answer ──▶ Host taps rank (or Wrong) ──▶ Server engine:
         ▲                               claim · base points · ×5 Wild · Streak window · score
         │                                                         │
         └──── next player ◀── turn ends ◀────────────────────────┘
                                                                   │
  Everyone had a turn / 12 claimed ──▶ reveal ranking ──▶ rotate order ──▶ ≥100? ──▶ winner / tie-breaker
```

Every design decision protects one invariant: **the server's game engine is the only thing that
decides points, claims, turns and cards, and players never receive an answer that has not been
claimed yet.**

## 2. Requirement groups (mapped to brief sections)

| Group | Brief §§ | v1? |
|---|---|---|
| Rooms, codes, QR join, lobby, remove player | 4 | Yes |
| Scoring table, exclusivity, host validation, corrections + audit | 5 | Yes |
| Turn order and rotation | 5E | Yes |
| Wild and Streak cards | 6 | Yes |
| 100-point endgame, tie-breakers, final results | 7 | Yes |
| Live leaderboard and answer feed | 8 | Yes |
| Categories, automatic balanced question selection | 9A–B | Yes |
| Question database, aliases, sources, verification, importer | 9C–D | Yes |
| ≥30 test questions, labelled TEST DATA | 9E | Yes |
| All screens A–J | 10 | Yes |
| Dark party-game visual identity, animations | 11 | Yes |
| Server-authoritative engine, realtime sync, event log | 12–14 | Yes |
| Reconnect, host recovery, pause/resume | 13 | Yes |
| Profiles and stats (guest, per device) | 10J | Yes |
| Store preparation | 17.7 | Yes (no publishing without the owner) |
| Arabic + English, RTL | owner's standard | Yes |

## 3. Gaps in the brief, and the default used

The brief asks to raise anything that changes gameplay. Each item marked ❓ was raised with the
owner. The development go-ahead was given with these defaults, so they are what the engine does.
Every one of them is a single, documented rule in `packages/shared/src/engine.ts` and can be
changed without touching screens.

1. **How long a question lasts.** ❓ Default: each participant gets **one turn** per question, in
   turn order. The question ends when everyone has had a turn, or earlier if all 12 answers are
   claimed. A Streak second attempt is part of the same turn.
2. **Wild Card and a wrong answer.** ❓ Default: Wild is switched on during your own turn, before the
   host rules on your answer. If that answer is wrong (or already claimed), the card is **used up with
   no effect**. If the host skips your turn (no answer given), the card goes back to available.
3. **Streak fails after a negative first answer.** ❓ Default: "lose the points earned from the first
   answer" is applied literally: the first answer's points are **cancelled**, whatever their sign. A
   −11 first answer therefore gives the 11 points back. The first answer stays claimed.
4. **Wild + Streak in one turn.** ❓ Default: allowed. Wild applies to the attempt it was switched on
   for. If Streak fails, the first answer's *actual* points (including ×5) are cancelled.
5. **Dropping back under 100 within the final question.** ❓ Default: the endgame **stays triggered**.
6. **Host corrections.** ❓ Default: the host can void any answer of the current question while the
   question or its results are on screen. Voiding removes the points and the claim, gives back any
   card that answer used, and is written to the audit log. The host can also choose **"give the turn
   back"** for the most recent answer, which replays that turn. Turns never rewind on their own.
7. **Disconnected player on their turn.** ❓ Default: the host can **skip** the turn (zero points), or
   wait. A skipped Streak second attempt counts as a failed second attempt.
8. **Not enough questions.** ❓ Default: the host must choose categories with at least 15 ready
   questions. If a game still runs out, it ends on current scores; if the top is tied and no question
   is left for a tie-breaker, the tied players share the win (and the host is told why).
9. **Player numbers.** ❓ Default: minimum 2, maximum 16 (setting), tested with 12.
10. **When is Streak offered?** After a correct first answer, if the player still has Streak and at
    least one answer is unclaimed, the turn waits for the player to tap **Use Streak** or **Done**.
    The host can always tap **Next player** to move on. Fast for everyone, and nobody can stall.
11. **When can Wild be switched on?** Only during your own turn while an answer is awaited (attempt 1,
    or attempt 2 after Streak). Not before your turn — keeps the rule easy to explain.
12. **Tie-breaker order and scoring.** Only the tied players play, in the current rotated order.
    Points are added to their game totals and the highest total among them wins. Repeat until one.
13. **Ending a game early.** The host can end the game; the top score at that moment wins (ties share).
14. **Names.** Display names must be unique within a room (case-insensitive), 1–20 characters.
15. **Host is not a player.** As in the brief. A host who wants to play can join from a second phone.

## 4. Product decisions (owner's playbook defaults)

- **Languages:** app screens in Arabic and English (Arabic default when the phone is Arabic), RTL via a
  root `direction` style. Question content supports both languages; the test set is written in both.
- **Identity:** no sign-up. A phone gets a device identity on first launch; display name and avatar
  colour are kept on the phone and on the server. Stats (games, wins, best, average) belong to it.
- **Market:** not limited to Jordan. No money, no SMS, no maps.
- **Name:** "Outrank" is the working name; branding can be swapped from one theme file.

## 5. Explicitly out of scope (brief §9, §18)

Question editors, community submissions, AI-generated questions during play, extra game mechanics,
in-app purchases, chat.
