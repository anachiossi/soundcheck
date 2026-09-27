# soundcheck — rules for anyone (human or agent) changing this code

Offline-first wireless-mic app for film sets. Owner: Ana Chiossi, a sound person, not a
programmer. **The code must stay readable by Ana.** Plan: `G:\My Drive\2.TRABALHO\MY_APP\SOUNDCHECK_PLAN.md`.
Spec for features/bugs (IDs like G08, BUG-04, V-DS-03): the two `*_FEATURE_AUDIT.md` files in
the same folder; the "Suggested" column is the default decision unless Ana marked otherwise.

## Code rules
1. No build step, no npm packages in the app. `index.html` → `src/main.js`. Only `vendor/` holds outside code.
2. One job per file, under ~200 lines. Every file starts with a plain-English comment: what it does, who uses it.
3. All data changes go through actions in `src/state.js`. Screens never change data themselves.
4. Plain names (`scene`, `row`, `character`, `tx`, `lav`). No clever one-liners, no abbreviations.
5. Colours and sizes only as tokens at the top of `app.css`.
6. Dates are `YYYY-MM-DD` strings; never `new Date('2026-09-21')` (time zones shift the day).
7. Test names read like a checklist sentence.
8. When adding an app file, add it to `FILES` in `sw.js` and bump `VERSION`.

## Data safety
- This repo is **public**. Never commit film data, sheet links, Apps Script URLs or tokens.
  Film data lives in the private repo `soundcheck-data` (cloned at `D:\sound_check_data`),
  one folder per film. Project files `*.soundcheck.json` are gitignored here.
- Never write to the live Google Sheets / Apps Script without Ana's explicit OK.

## Commands
- `npm test` — logic tests (must pass before every commit)
- `npm run serve` then `node tests/screens.mjs <project file>` — screenshots at phone/iPad/laptop
  size + offline check, into `.shots/` (gitignored)
- `node tools/snapshot.mjs D:\sound_check_data\projects\<film>` — rebuild a film's project file from Sheets

## Logging
Log decisions dated in `D:\script_read_claude\docs\` and in mempalace (wing `sessions`, room `planning`).
