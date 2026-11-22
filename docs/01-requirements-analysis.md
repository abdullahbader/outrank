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

1. **How long a question lasts.** ✅ Owner's rule (2026-11-21): turns go **round the table again and
   again** in turn order. The question ends when **every positive answer (ranks 1–10) is claimed** —
   ranks 11 and 12 may stay unclaimed — or when the **host ends (skips) the question**, which the host
   can do at any time. A Streak second attempt is part of the same turn. Ending a question while a
   Streak extra answer is pending keeps the first answer and gives the Streak (and an unused Wild)
   back.
2. **Wild Card and a wrong answer.** ❓ Default: Wild is switched on during your own turn, before the
   host rules on your answer. If that answer is wrong (or already claimed), the card is **used up with
   no effect**. If the host skips your turn (no answer given), the card goes back to available.
3. **Streak fails after a negative first answer.** ❓ Default: "lose the points earned from the first
   answer" is applied literally: the first answer's points are **cancelled**, whatever their sign. A
   −11 first answer therefore gives the 11 points back. The first answer stays claimed.
4. **Wild + Streak in one turn.** ❓ Default: allowed. Wild applies to the attempt it was switched on
   for. If Streak fails, the first answer's *actual* points (including ×5) are cancelled.
5. **Reaching 100.** The current question carries on under rule 1 (until ranks 1–10 are claimed or
   the host ends it); no new regular question starts after it.
   **Dropping back under 100 within the final question.** ❓ Default: the endgame **stays triggered**.
6. **Host corrections.** ❓ Default: the host can void any answer of the current question while the
   question or its results are on screen. Voiding removes the points and the claim, gives back any
   card that answer used, and is written to the audit log. The host can also choose **"give the turn
   back"** for the most recent answer, which replays that turn. Turns never rewind on their own.
7. **Disconnected player on their turn.** ❓ Default: the host can **skip** the turn (zero points), or
   wait. Play moves on to the next player round the table. A skipped Streak second attempt counts as a failed second attempt.
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
in-app purchases.

## 6. Added after the brief (owner's requests)

- **Players can be in the room or joining from elsewhere.** (2026-11-21)
- **Game chat** for everyone in the game (host and players): plain text up to 200 characters, kept
  with the game; the host can delete any message and mute/unmute a player. Rate-limited.
- **Quick reactions**: 8 one-tap emoji that float across every screen with the sender's name. Not
  stored. Rate-limited; muted players cannot react.
- **Countdowns** (owner, 2026-11-21): the host picks the time to answer per turn when creating
  the game (off, 15, 30, 45 or 60 s; default 30). At zero the turn ends with zero points, like a
  wrong answer (a Wild switched on is used up; a Streak extra answer fails); the host can undo it.
  The Streak choice has 10 s (at zero the turn moves on, points kept) and the results screen 10 s
  before the next question starts by itself. The server keeps the clock; pause freezes it.
- **Pass**: the host taps Pass when a player passes — zero points, turn moves on, a Wild switched
  on is given back; passing on a Streak extra answer counts as failing it.
- **Used cards** are crossed out with an X on the player's phone and in the leaderboard.
- **11 + 12 combo** (owner, 2026-11-22): when the same player claims both rank 11 and rank 12 in
  one question (on any turns, Streak included), those two answers are worth a fixed **+20** in
  total instead of −23; Wild does not multiply it. Undoing or cancelling either half removes it.
- **Typed answers** (2026-11-22): on their turn a pop-up lets the player type the answer they are
  saying; the host sees it with the likely match highlighted and confirms with one tap. Players
  never receive the suggested rank.
- **Emoji profile pictures**; **rank numbers on each player's picture** replace the bottom
  leaderboard. (A docked always-open chat was tried and reverted: it hid the game; chat opens on tap again.)
- **Look**: a boy hops along the logo's columns; Join shows a runner leaping onto a game
  controller; each category has a real photo (Unsplash, credited in apps/mobile/assets/photos).
- **Voice chat**: requested; needs an outside voice service — see docs/11 once chosen.
