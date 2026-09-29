# soundcheck — rules for anyone (human or agent) changing this code

Offline-first wireless-mic app for film sets. Owner: Ana Chiossi, a sound person, not a
programmer. **The code must stay readable by Ana.**
**Start here: `docs/STATUS.md`** (what exists, where things stand, what's next), then `docs/HOW_IT_WORKS.md` (file map). Plan: `G:\My Drive\2.TRABALHO\MY_APP\SOUNDCHECK_PLAN.md`.
Spec for features/bugs (IDs like G08, BUG-04, V-DS-03): the two `*_FEATURE_AUDIT.md` files in
the same folder; the "Suggested" column is the default decision unless Ana marked otherwise.

## Code rules
1. No build step, no npm packages in the app. `index.html` → `src/main.js`. Only `vendor/` holds outside code.
2. One job per file, under ~200 lines. Every file starts with a plain-English comment: what it does, who uses it.
3. All data changes go through actions in `src/state.js`, `src/editing.js` or `src/sync.js`. Screens never change data themselves.
4. Plain names (`scene`, `row`, `character`, `tx`, `lav`). No clever one-liners, no abbreviations.
5. Colours and sizes only as tokens at the top of `app.css`.
6. Dates are `YYYY-MM-DD` strings; never `new Date('2026-09-21')` (time zones shift the day).
7. Test names read like a checklist sentence.
8. When adding an app file, add it to `FILES` in `sw.js` and bump `VERSION`.

## Data safety
- This repo is **public**. Never commit film data, sheet links, Apps Script URLs or tokens.
- Film data = JSON files in the private repo `soundcheck-data` (cloned at `D:\sound_check_data`),
  one folder per film (layout: top of `src/store/repo-files.js`). It is the master copy.
  The app reads/writes it through `src/store/github.js` with a per-device key.
- The Google Sheets are retired (archive). `tools/import-from-sheets.mjs` is only for moving an
  old film in. The app never talks to the Sheets.
- Tests that write to GitHub run ONLY on a scratch branch (`sync-test`), never `main`.

## Commands
- `npm test` — logic tests + every app file must parse (must pass before every commit)
- `npm run serve` then `node tests/screens.mjs <project file>` — screenshots at phone/iPad/laptop
  size + offline check, into `.shots/` (gitignored)
- `GH_TOKEN=… SC_BRANCH=sync-test node tests/sync.mjs` — edit/sync end-to-end on real GitHub
  (reset the `sync-test` branch to main first; `gh` is at `C:\Program Files\GitHub CLI\gh.exe`)
- `node tools/import-from-sheets.mjs D:\sound_check_data\projects\<film>` — move an old film out of Sheets

## Logging
Log decisions dated in `D:\script_read_claude\docs\` (current: `2026-09-29_soundcheck_log.md`) and in
mempalace (wing `soundcheck`, room `decisions`). Update `docs/STATUS.md` when something ships, then run
`python D:\script_read_claude\tools\publish_docs.py`: it copies every doc to Google Drive
(`MY_APP/soundcheck/docs/`, incl. `SOUNDCHECK_ALL_DOCS.md`) so Ana can discuss ideas in Claude chat.

## Editing safely
Write JS/CSS with the Write/Edit tools, never inline in a bash heredoc or a python one-liner:
a backslash-n inside a quoted string becomes a real line break and breaks the app.
