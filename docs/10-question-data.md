# 10 — Question Data: format, checks and replacing the test set

The game engine never contains questions. It only receives a list of question ids when a game
starts, and the server joins the text when it builds each phone's view. So the whole question list
can be replaced without touching the engine or the screens.

## Files

| File | What |
|---|---|
| `content/categories.json` | Categories: `id`, English and Arabic name, icon, sort order. Add a line to add a category. |
| `content/test-questions.json` | **TEST DATA**: 30 sample questions, 3 per category. Dataset label `TEST`. |
| `content/validate.mjs` | The checker. Run it on any file before importing. |
| `apps/api/scripts/import-questions.mjs` | The importer. It runs the same checker first and refuses a file with problems. |

## One question

```json
{
  "id": "geo-largest-countries-area",          // stable, unique, lowercase-dashes
  "category": "geography",                      // must exist in categories.json
  "difficulty": 1,                              // 1 easy · 2 medium · 3 hard
  "title": { "en": "…", "ar": "…" },
  "rankingBasis": { "en": "…", "ar": "…" },     // what is measured and how (shown to players)
  "asOf": "2024",                               // for rankings that change over time
  "explanation": { "en": "…", "ar": "…" },      // optional; shown when the answers are revealed
  "sources": [{ "label": "…", "url": "…" }],    // at least one
  "verification": "verified",                   // unverified | verified | disputed
  "lastVerified": "2026-11-21",                 // required when verified
  "status": "active",                           // optional: draft | active | retired
  "answers": [                                  // exactly 12; first = rank 1
    ["Russia", "روسيا", ["Russian Federation"], "17.10 M km²"],
    …
  ]
}
```

Each answer is `[English, Arabic, other accepted names, note]`. The host sees the other names and
the note (for example the measured value) on the answer board, to help decide on spoken answers.

## What the checker refuses

- Not exactly 12 answers, or a missing English answer
- The same name (or alias) used for two different ranks — the host could not tell them apart
- Unknown category, duplicate id, missing title, missing ranking basis, no source
- `verified` without a `lastVerified` date; unknown difficulty, status or verification value

Only questions that are **active and verified** are ever picked for a game. Use `unverified` or
`disputed` to keep a question in the database without it reaching players.

## Commands

```powershell
node content/validate.mjs                                    # check the test set
node content/validate.mjs path\to\main-questions.json        # check another file
npm run questions:import -- --dry-run                        # what would change
npm run questions:import                                     # import the test set
npm run questions:import -- --file C:\path\main-questions.json --replace
```

Then restart the API so it reloads the question text.

## Replacing the test set with the real list

1. Put the real questions in a new file with `"dataset": "MAIN"` (same format as above), and add any
   new categories to `content/categories.json`.
2. `node content/validate.mjs C:\path\main-questions.json` until it says **ready to import**.
3. Import it: `npm run questions:import -- --file C:\path\main-questions.json`.
4. Retire the test set so it never appears in real games: set `"status": "retired"` on every
   question in `content/test-questions.json` and import it again, or import an empty `TEST` file
   with `--replace`.
5. Restart the API. The Create Game screen now shows the new counts per category.

Retired questions are never deleted, because finished games still point at them.

## About the TEST DATA

The sample rankings were written from the cited public sources and checked for internal
consistency, but they were not re-checked live against those sources. Before using them in front of
players, re-check the ones whose numbers change over time: population (UN 2024), GDP (World Bank
2023), crop production (FAOSTAT 2022), and the nutrition values (USDA). Rankings with known disputes
say so in their explanation: river lengths, close moon diameters, Ethiopia and Mexico's population.
