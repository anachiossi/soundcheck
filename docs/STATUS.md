# soundcheck — where things stand (start here)

Last updated: 2026-10-02 · live version **v98** · https://anachiossi.github.io/soundcheck/
Read this first in a new session, then `CLAUDE.md` (rules) and `docs/HOW_IT_WORKS.md` (file map).
The film-specific diary (decisions, dates, what Ana said) is private:
`D:\script_read_claude\docs\` → `2026-09-27_soundcheck_plan.md`, `2026-09-29_soundcheck_log.md`,
`2026-09-29_soundcheck_handoff.md`.

## Films
- **La buona educazione** (LBE) — the main film, 30 days, email robot on. Always comes first.
- **Vigília** — short, Italian weekend 3–4 Oct 2026, built by hand (no PDL/ODG):
  `D:\script_read_claude\projectsigilia\workuild_vigilia.py`. No email robot (no inbox.json).
  Its script reader options are in its own settings.json (`script_reader`: watermarks, unnumbered_scenes).
- Rule (Ana): reader/parser configuration lives in the film's data; never change another film's results.
  Before touching a reader, save LBE's readings and compare after (script + every sides PDF).

## The two repos
| | Where | What |
|---|---|---|
| App (this repo, **public**) | `D:\sound_check` · github.com/anachiossi/soundcheck | PWA on GitHub Pages, no build step; `pipeline/` = Python email robot + script readers |
| Data (**private**) | `D:\sound_check_data` · github.com/anachiossi/soundcheck-data | one folder per film (`projects/<film>/`), JSON = the master copy; `.github/workflows/emails.yml` = the email robot |

Phones/laptop keep their own copy per film (IndexedDB) and sync with GitHub using a per-device
fine-grained key (Contents RW + Actions RW + Variables R on soundcheck-data only).

## What the app does today
**Mics department** (tabs Schedule · Scenes · Cues · Kit · Projects)
- Schedule Day / Week / All film; every scene = slate (#, INT/EXT, time, set, location, pages,
  story day, synopsis, notes) + 🔊 sound bar + mic table (character · TX · lav · speaks).
- Edit presets anywhere, offline (✎ → picker → Save; warnings: TX/lav twice, "No lav" + lav).
- Kit: characters (preferred TX / lavs), TX, lavs. Images (Export): scene, day, week, all film.
- 📄 ODG / Sides PDFs of every day on the device (read offline).
- 📬 Proposals from production emails (ODG, sides, PDL, crew): accept / reject each change.
- ✉ badge: when Gmail was last checked; "Check emails now" starts the robot from the phone.
- 🎙 **Cues**: learn a scene's lines full screen (phrases, speaker colours, scroll); ✎ edit / delete /
  add lines on set (`lines/set/`); **Scene Map** (colour strip, beats, last words Full/Fast,
  ▶ auto-scroll with speed, touch to pause); **Scene Timeline** = a player, full screen: the scene's
  script scrolls like Spotify lyrics (`parts/scene-script.js`, names on a highlight of the character's
  colour), the Pro Tools-style track of speakers is the play bar (cursor, speed, scrub, paced like a
  person speaking — `cues-timeline-rules.js`). Map and Timeline open full screen (`main.js` focus).
- 🔊 **Read aloud** (Timeline and Cues): the phone's own voices (`src/read-aloud.js`); two per film,
  female + male, in `settings.json` → `voices`; each character's `voice` in
  characters.json. iOS quirks handled in v58: extra end/interrupted events, voices list empty at
  start (asked at each line), no word positions (cursor paced by itself, waits at the line end);
  v60: a listed-but-silent voice falls back to the default one, Kit ▶ shows what the voice did. No Siri voices (not given to web pages).
  Test with a fake iPhone voice: `.shots/voice-ios.mjs`.
- v66: 0.8 s silence between lines in 🔊 (LINE_PAUSE); Speak Screen hears "Prince John." before each line.
- Cues is Speak Screen friendly (v62–63): only the dialogue is readable (the rest aria-hidden), and the
  following lines are there invisibly (.sr-only) so Speak Screen reads to the end of the scene.
- iPhone gives web pages only ONE Italian voice (Alice · Standard, in Safari, Chrome and the home-screen app)
  although Emma Premium + Luca are downloaded: no male voice in-app on iOS. Options: Speak Screen (Siri),
  or cloud voices recorded per scene (offered to Ana, not decided).
  v64: Kit voice menu and the character voice field removed (Ana: one voice, no choices, no warnings).
- Cues text priority (`cues-rules.js`): on-set edit (`lines/set/`) → newest sides → script;
  a newer paper after an edit is flagged, never overwrites it.
- Schedule: finished days green, opens on today; conflicts badge opens a Keep mine / Use the other list.
- 🔊 **Sound breakdown** per scene (`sound/<scene>.json`): dificultômetro level MOS · AMB · EASY ·
  MEDIUM · HARD (Ana's colours), flags with emojis (💧 😱 🍝 💥 🎵 🚗 👥 👶 🐾), notes, lav warnings per
  character (🚫 no lav, 📍 placement, 💧 water, 😱 loud). Every scene-number pill (`ScenePill`) is
  tinted by the level — except the slate's #number and the images, which stay plain black.

Look: neutral (black selected, grey page; colour only for information). Dark screen:
Projects → Screen: Auto / Light / Dark (`src/theme.js`); Cues at night = dark with the speaker's
colour as a frame.

**IFB department** (switch Mics | IFB): one IFB list for the film (OUT / ✓ back), crew with
Call / WhatsApp / 🚨 emergency order, IFB kit; new crew from each ODG proposed next to their role.
IFB list editor: ↑ moves a row up (v59), like the mics editor.

**Gear department** (tabs Truck · Inventory · Manuals · Projects), per film in `gear/` (v95 redesign,
Ana's mockup "Gear inventory redesign", 2 Oct):
- Truck: the loading checklist — every volume numbered 1, 2, 3… (×3 = '28–30'), tap a row to tick,
  "10 / 34 volumes loaded · 24 to go", category headers with counts; History of in / out / changes.
- Inventory: search + one tree (carts and cases open ▸; loose things after them A–Z, no fold (v96));
  searching shows the matches inside the cases they are in; ticks only in ☑ Check mode;
  press, hold and drag a square or name into a case (v97, `parts/gear-drag.js`, `.shots/gear-drag.mjs`).
- Objects: name, brand, type, qty, colour, nicknames, inside, volume, note + **details** (own fields;
  the type offers the fields others of that type use — `fieldsOfType`). Rules in `src/gear-rules.js`.
- Manuals by brand (`docs/manuals/<brand>/`, `gear/manuals.json`). Hours / timesheet live in Projects.
- LBE gear = Angelo Bonanni's kit, built by Ana day by day from photos (Inf. Mic's done 2 Oct).

## Email robot (runs in the cloud, no laptop needed)
Gmail (sound.chiossi@) ← production forwards → **Apps Script trigger every 10 min**
(`pipeline/gmail-trigger.gs`, installed in that Google account) → starts GitHub Actions
`emails.yml` in soundcheck-data → `pipeline/run.py`: downloads ODG/sides/PDL by IMAP, writes
proposals + PDFs + Cues lines, commits. Backup: GitHub cron every 30 min (unreliable on its own).
The trigger reports each check to the GitHub variable `LAST_GMAIL_CHECK` (the ✉ badge).

## Checks before every release
1. `npm test` (logic + `syntax.test.js`: every app file must parse — a broken file = blank app).
2. `npm run serve` + `node tests/screens.mjs .shots/<film>.soundcheck.json` (phone/iPad/laptop + offline).
3. For sync changes: reset branch `sync-test` to main, then
   `GH_TOKEN=$(gh auth token) SC_BRANCH=sync-test node tests/sync.mjs` (real GitHub, two devices).
4. Bump `VERSION` in `sw.js` (and add new files to `FILES`); push; wait until
   `https://anachiossi.github.io/soundcheck/sw.js` shows the new version.

## Gotchas learned the hard way
- Editing JS from a bash heredoc turns `'\n'` into a real line break → write files with the Write/Edit
  tools or a `.py` file, never inline escapes in a heredoc.
- GitHub's scheduled workflows start late or not at all → the Gmail trigger is the real clock.
- Production sometimes sends the sides in a separate reply email → `sides_by_day` matches them by day.
- A `cat >>` without a heredoc waits for input forever (a stuck command).
- `gh` lives at `C:\Program Files\GitHub CLI\gh.exe` (not on the bash PATH).

## Plan (agreed 2026-09-29) → `docs/DESIGN_new_film.md`
Done: LBE `settings.json` + preset generator/checker (`pipeline/presets.py`, `propose_presets.py`;
first review sent 29 Sep for days 8–30). Next: kit import/export → new-film intake rehearsed on a mock
film before November.

## Open / next (none started)
- **Simon game** for Cues (quiz on the order of speakers): designed, waiting for Ana's go.
  Proposed defaults: each round replays from the start of the beat; cue words only on a mistake;
  silent by default.
- Questions left to Ana: should the sound bar's level chip also be plain? should the lav-picker
  warning be quieter too?
- TX preset generator inside the app (old Colab notebook) — milestone E, not started.
- Analyzer for a NEW film writing schedule.json / scenes.json / sound/ directly (today: one-off
  scripts in `D:\script_read_claude\projects\<film>\work\`).
- Read aloud on the Scene Map (mentioned, not started). Verify v58 read-aloud on the real iPhone.
- Scene order comes from the ODG only (sides are used for speakers). Day 5 ODG said 23·4, sides and
  app 4·23 — asked Ana which wins when they differ; no answer yet.
- ODG reader: a location can swallow the next column ("PIANO NOBILE (2°) STAND BY:").
- GitHub Actions: checkout@v4 / setup-python@v5 warn about Node 20 (harmless for now).
