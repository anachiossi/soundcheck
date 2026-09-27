---
name: run-soundcheck
description: Launch the soundcheck app locally, screenshot every screen at phone/iPad/laptop sizes, test offline, editing, GitHub sync and exported images.
---
1. `cd D:\sound_check`, start `npm run serve` in the background (port 8321). `npm test` first.
2. Screens + offline: `node tests/screens.mjs <a .soundcheck.json backup file>` (make one with Projects → Backup files).
3. Editing + sync on REAL GitHub, scratch branch only:
   create `sync-test` from main (`gh api -X POST repos/anachiossi/soundcheck-data/git/refs ...`),
   run `GH_TOKEN=$(gh auth token) SC_BRANCH=sync-test node tests/sync.mjs`, then delete the branch.
4. Read the PNGs in `.shots/`. Never commit them.
