# soundcheck — where things stand (start here)

Last updated: 2026-10-20 · live version **v173** · https://anachiossi.github.io/soundcheck/
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
- Same-day kit (v131, `preset-rules.js` → sameDayKit): Save copies the TX, lav and accessories set for a character to that character's rows in the day's other scenes (an emptied TX doesn't travel; another character holding that TX/lav there is emptied). `settings.presets.lav_rules.not_used` hides lav models from the picker and the generator (LBE: 6061).
- Acc. column (v128, `src/accessories.js`): the Speaks column's label (Speaks ⇄) swaps that column for accessories, per phone;
  rows get optional `acc: [gear ids]`; ✎ picks from Gear straps / pouches / lav furs / covers / foam mounts (character's
  `usual_acc` first); lav-style pills labelled Waist / Ankle / Pouch (`accLabel`); images keep Speaks. Optional everywhere.
- Edit presets anywhere, offline (✎ → picker → Save; warnings: TX/lav twice, "No lav" + lav).
- Kit: characters (preferred TX / lavs), TX, lavs. Images (Export): scene, day, week, all film.
- 📄 ODG / Sides PDFs of every day on the device (read offline).
- 📬 Proposals from production emails (ODG, sides, PDL, crew): accept / reject each change.
  v106: every proposal waits for Ana again, ODGs too (v99's auto-apply rolled back — beta, catch mistakes like "27 fin").
  ⏰ alarms never wait: `nextShootingDay` uses the date/call/wrap of an ODG not yet reviewed (`withWaitingOdgTimes`);
  the Tomorrow card shows "📬 ODG #N waits for your review — the alarms already use its call".
- ✉ badge: when Gmail was last checked; "Check emails now" starts the robot from the phone.
- 🎙 **Cues**: learn a scene's lines full screen (phrases, speaker colours, scroll); ✎ edit / delete /
  add lines on set (`lines/set/`); **Dialogue map** (was Scene Map; colour strip, beats, every line laid out like the script page — name centred, one phrase per row with a tab (v106), a new beat only where someone enters, leaves or dies; cries, laughs, screams, whispers and shots as notes on the line (v111, `movesIn`); no beat headings: before each line, its action in one line like the script ("Lucrezio and Florin are there. Ines enters. Lea screams.") exactly where the sides print it (v115); the strip is a scroll bar with a ▼ where you read (v110),
  ▶ auto-scroll with speed, touch to pause); **Scene Timeline** = a player, full screen: the scene's
  script scrolls like Spotify lyrics (`parts/scene-script.js`, names on a highlight of the character's
  colour), the Pro Tools-style track of speakers is the play bar (cursor, speed, scrub, paced like a
  person speaking — `cues-timeline-rules.js`). Map and Timeline open full screen (`main.js` focus).
- 🟥 **Who's next** (v174–181, Ana 20 Oct; `cues-game-rules.js`, `screens/cues-game.js`): the "Simon" game for
  the order of speakers — teach, quiz, teach one more, quiz (v176). The joystick on each scene in the Cues tab
  (next to Cues · map · timeline), also in the Map and Timeline rows. TEACH: line 1 in its speaker's colour, the
  speaker's button lit (tap the line to go on, no timer since v180); QUIZ: the line's words on grey, no name — tap who says it;
  right → it turns into the speaker's colour and name for a moment, like while learning (v177). v181: each round teaches only the NEW line, then the quiz goes from the start of the beat (less repetitive).
  A mistake says who it was and teaches just that line. Beats as in the map, max 8 lines. Silent.
- 🔍 **Search the lines** (v112, `parts/line-search.js`) in Cues, Dialogue map and Timeline: words and speakers (v116), every match highlighted
  (capitals / accents ignored), "2 / 7" with ↑ ↓ — on set "we start from WORD".
- v153 (Ana, 16 Oct): **read aloud removed** — the app never speaks (a phone talking by accident on set
  is the worst case; hard to set up, poor on other phones). `src/read-aloud.js` and the 🔊 buttons in
  Cues and Timeline are gone; an old `voices` key in settings.json / `voice` in characters.json is ignored.
- v153 (crew sharing step 2, branch only): **crew link** — Projects → Share with crew (Ana) copies a
  `#join=` link per person; opening it connects that phone as crew (name, read only) and downloads the film.
  Crew phones never commit (outbox stays on the phone); no Connect, Share with crew, ✉ badge or ⏱ Hours.
- v153 (crew sharing step 3, branch only): **crew suggestions** — a crew phone's saved changes are sent as
  GitHub issues ("Suggestion from Davide: Gear: + Sandbag", what changed + a JSON block), badge
  "● n proposed"; when Ana closes one ("approved" / "not approved: reason") the phone takes the film's
  version back and logs the answer. A crew phone lists only its own film. Ana's inbox (approve) is step 4.
  Crew hours / wrap alerts (`hours/`, `push/`) stay on the phone, never sent.
- v153 (crew sharing step 4, branch only): **approving crew suggestions** — on Ana's devices a 📬 banner per
  person ("Davide suggests 2 changes") opens the suggestions: ✓ Approve applies them to the current film
  (warns "Changed meanwhile" first, then "Approve anyway") and uploads as a normal save ("— proposed by
  Davide, approved"); ✕ Don't approve takes an optional reason. The answer is written on the issue only
  after the upload; offline it waits. No crew issues (or a key that can't read issues) → app as before.
- v153 (crew sharing step 5, branch only): **crew screens** — crew phones hide Ana's personal parts (wrap
  clock and wrap question, 🔔 wrap alerts, wake plan / alarms, Help → Wrap hours and Alarms, Hours and `#hours`).
  Projects (crew): "My suggestions" with neutral answers, and "Enjoyed soundcheck? Share some feedback" (stars,
  helped, annoyed, text; kept on the phone offline, sent at sync as a `crew-feedback` issue); offered once by
  itself from 3 days before the last shooting day. Ana: "Feedback from the crew" banner + Mark as read; Remove /
  Restore names in Share with crew (their suggestions and feedback are ignored).
- v153 (crew sharing step 6, branch only): **My call + crew hours** — Projects → My call (every device, kept
  on the device): General crew call (default, as before) or Personal call = your name as printed on the call
  sheet, matched in `calls.json` (no capitals/accents/extra spaces); not on that day's sheet → crew call + a
  muted note on Hours. Hours, ⏱ wrap clock, timesheet and the wake plan use it; the Schedule keeps the crew call.
  Crew phones get Hours and the wrap clock back (their OWN hours, phone only): they never download the
  film's `hours/` and `push/` (an old copy is dropped at the next sync) and get "📊 Export my timesheet" (their
  block only). Still hidden on crew: wake plan / alarms, 🔔 wrap alerts, Help → Alarms.
- v154 (branch only, 16 Oct): review fixes — a whole-file suggestion that clashes can't be approved anyway;
  decisions sent only after the save; crew phones don't see production-email proposals; joining with no
  signal waits and retries. Checked in Chromium (owner + crew, phone/iPad/laptop, offline). Kit grid overflow
  and cut lav labels at phone size are older (also on main), still to fix.
- v155 (branch only, 16 Oct): **Kit grid fixed** — nothing runs off a phone screen any more (B1's 🔋 tag sits above
  its model), lav pills show the full "6060 10", long names wrap; wider columns on iPad/laptop (`--kit-col`).
- v156 (branch only, 16 Oct): **notifications per person + robots follow My call** — push files say whose phone
  (`person`, `role`); `send_push.py` audience `owner` (all current alerts, Ana's phones only) / `all`. Ana's
  Personal call is saved as `commute.my_name`; Tomorrow push, bedtime and automatic alarms start from her own
  call (else the general call). Apps Script pasted + ✎ New version on 17 Oct (alarms checked identical before). Python tests in
  `tests/test_*.py`.
- v157 (crew sharing step 8, branch only, 16 Oct): **one private repo per film** — Projects → Film repos (Ana's
  devices): extra repos her ONE key reads (`connection.repos`, checked on Add). The films list reads every repo;
  each downloaded film remembers its repo (`project.source`) and sync, documents, crew suggestions, ✉ robot and
  crew links all use it (`connectionFor` in `src/film-source.js`). Films without a source (LBE today) = the main
  repo, unchanged. Same film id in two repos: both listed with the repo name, the second refused.
  `tools/new-film-repo.mjs` prepares the next film's folder; Apps Script reads the `REPO` script property
  (default soundcheck-data). Setup steps: `docs/CREW_SHARING.md` → "Setting up the next film".
- v158 (review fixes, branch only, 16 Oct): opening another film during a sync stops it quietly (no
  upload, the other film untouched: `src/sync-store.js`); owner/repo compared ignoring capitals; a backup
  file keeps the film's repo; films of the main repo get no `source` (follow the main connection, as
  before v157); "Personal call" with no name yet leaves the robots' `my_name` alone; a failed film-list
  read says "No signal: showing films on this device." instead of "Looking for films…".
- v159 (18 Oct, live): **robots never fail unseen** — after the email robot failed 16–18 Oct (push contact
  refused, ODG #21 never saved, Monday alarm wrong): a failed run emails the production mailbox once per
  breakdown (`pipeline/robot_failed.py`, last step of emails.yml / wrap-alerts.yml); the ✉ badge reads
  "✉ ✗ robot failed"; a notification that fails never stops the ODG save; a schedule day with no date fails
  the run (after saving) and is never painted green. ODG reader: casts wrapped over two lines, tables with no
  "Tot.", crew list with no TROUPE heading (ODG #21 BOZZA); a day's new scenes always carry its date/times.
- v160–166 (18 Oct): lav accessory from the scene (INT/INT-EXT → mini mount, EXT → plush sleeve, lav's colour;
  `lav-acc-rules.js`, settings `presets.lav_accessories`); every TX gets the character's usual strap/pouch (`usual-acc.js`,
  Kit → usual_acc from 27fin); mic table with no "…" (columns as wide as their words, more pages); battery pill
  🕒 time left + empty-battery icon before the time it runs out.
- v171 (19 Oct): **batteries charge by themselves** — the mic table keeps battery numbers (they last
  differently); a battery coming out of a TX (swap or OFF) goes straight to Charging and is offered again as
  ready once its charge time is up (charger/group time, else 3 h), on the first charger of its type with a free
  slot (Gear order = preference; chargers can name a battery type, e.g. NP-50); alkaline AA (no charger) → Empty. No "charging… charged…" taps; Gear → Batteries
  only for being precise. (v170, timer without numbers, undone the same day.)
- v172 (19 Oct): **photo full screen fixed** — opened from a Gear sheet, the photo was cut to the sheet on the
  iPhone and its × hidden (Ana: "getting off an image is buggy"); the viewer is now drawn on the page itself.
- v173 (20 Oct): **battery photos** — Gear → Batteries shows each group's battery photo under its name (the
  group's Gear thing's first photo; tap → all its photos). Kit photos (data, not code): cables show one photo per
  connector end (`gear/connector-<type>.jpg`, 28 types, shared by all cables); branded gear inside the cases shows
  the maker/shop photo first, Ana's photo second.
- v182 (22 Oct): **"Turned on at"** in the battery sheet (Ana: "many times I forget to click ON") — set the time the
  TX really went on (e.g. 10:30 at 12:30) and its countdown starts from then; on a TX already ON, change the time and
  "Save time". A time typed stays the default for 10 min (one tap for each other lav). `battery-rules.js momentAt`
  (a time later than now = yesterday, night shoots), `battery-editing.js switchTx onAt / setOnTime`.
- v167 (18 Oct): **Costume column** — `costumes.json` (film data) says which costume change (ch.N) each character
  wears in each scene; none to 3 photos per change (front, back, detail) in the film's own private photos repo
  (`anachiossi/la-buona-educazione-photos`, 1600 px + thumbs). Phones keep all thumbs + full photos of the next
  3 days (`photos.js`); tap → full-screen viewer (`parts/photo-viewer.js`). Weeks 1–3 extracted from the
  costume department's PDFs (`D:\script_read_claude\projects\la-buona-educazione\work\costumes`). Next: weeks 4–6,
  adding/changing photos and changes from the app, the Lavaliers continuity file.
- v168–169 (19 Oct): **Kit photos** — the makers' official product photos (Ana: like the manuals, better than our own
  shots of tiny things) in a private repo shared by every film, `anachiossi/soundcheck-kit-photos` (gear/ 1600 px +
  thumbs 480 px). The film's `gear/photos.json` says which photo shows which Gear thing, lav model (brand + model)
  and TX model, with the page it came from (`gear-photos.js`). In the mic table (not the editor) tap a TX, lav or
  accessory pill → its photo full screen; a Gear thing's sheet shows its photo. Phones keep every thumb + the full
  photos of the next 3 days' mic lists. `photos.js` downloads both photo repos (costumes + kit) after each sync.
  Batch 1 (30 photos): mini mounts, plush sleeves, stickies, tape, foamies, straps (Ursa, Viviana), DPA lavs, Sanken
  COS-11D, Zaxcom ZMT4 / ZMT4-HM / ZMT3 / TRXLA3. Batch 2 (42): Zaxcom recorders/receivers/NP-50, Schoeps, Ambient
  Lockits/Slate, Cinela Piano/Pianissimo/COSI, Viviana, Bubblebee, Hollyland, beyerdynamic M 201, Speakeasy, Sanken
  CUB-01; every single lav/TX item shows its model's photo → 115 Gear items with a photo (8.4 MB repo).
  Left (no maker's page online, or brand/model unknown): Rycote lyres, Sennheiser G3/2000, Audioroot, Manfrotto,
  pouches, cases/boxes, cables, batteries/chargers — Ana's own photos or a dealer's, her call.
  Robot (same days): newest email wins (exact sent time), "nothing to commit" is not a failure, backup cron 5/day.
- Cues is Speak Screen friendly (v62–63, iPhone's own Siri reading, started only by a two-finger swipe):
  only the dialogue is readable (the rest aria-hidden), "Prince John." before each line, and the
  following lines are there invisibly (.sr-only) so Speak Screen reads to the end of the scene.
- Cues text priority (`cues-rules.js`): on-set edit (`lines/set/`) → newest sides → script;
  a newer paper after an edit is flagged, never overwrites it.
- Scenes tab: scenes already shot are dark grey (v114, `doneScenes`: every day they're on is over) — the film's progress.
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
  press, hold and drag a square or name into a case (v97, `parts/gear-drag.js`, `.shots/gear-drag.mjs`);
  a case's sheet lists its cases first with ↑ to reorder them (v108, `moveUpAmongCases`), then the loose things A–Z.
  v127 (Ana's pick from the study canvas "Gear inventory — UI study"): Inventory browses ONE case at a time, like
  Files / Finder — path on top (Gear › Maverick › Lav Acessories #2), ‹ back, ✎ edits the open case; its cases (case icon
  in their colour, count, ›), then ITEMS on paper grouped by type with short names (`itemGroups`, `shortName`; one-thing
  types go to OTHER); search lists every match with its path. State `gearPath`. Truck / sheet: dots (`Tinted`).
- Objects: name, brand, type, qty, colour, nicknames, inside, volume, note + **details** (own fields;
  the type offers the fields others of that type use — `fieldsOfType`). Rules in `src/gear-rules.js`.
- Rough counts (v152, Ana 15 Oct, RF Spare case): `qty_about: true` shows ×~15 everywhere (`quantityText`);
  tick "About that many" in the object's sheet. For repair cases full of cables / connectors nobody counts.
- Manuals by brand (`docs/manuals/<brand>/`, `gear/manuals.json`). Hours / timesheet live in Projects.
- **Gear to check (TODO)**: `D:\sound_check_data\projects\<film>\docs\gear-todo.md` (data repo, private) — every "?" in
  the gear list, grouped by case; remake with `python tools/gear_todo.py projects/<film>` (data repo). See its README.
- LBE gear = Angelo Bonanni's kit, dictated by Ana from photos and written by Claude in the data
  (`.shots/lbe-*.mjs`): Inf. Mic's, Maverick → Lav Acessories #1 (TX, lavs, …) and #2 (straps, pouches) done.
  Next: Maverick crates 3–4, Furs / Various / Lectro boxes, the other carts and cases.

## Email robot (runs in the cloud, no laptop needed)
Gmail (the production mailbox) ← production forwards → **Apps Script trigger every 10 min**
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
- Ana to answer: remove misread crew "Antonio Arte Astrid Ardenti"? keep new crew for review instead of auto-apply?
  warn when an ODG date and weekday don't match (ODG #13 "Giovedì 7")? TX 21 / B1–B3 / 4060… exist?
- Questions left to Ana: should the sound bar's level chip also be plain? should the lav-picker
  warning be quieter too?
- Analyzer for a NEW film writing schedule.json / scenes.json / sound/ directly (today: one-off
  scripts in `D:\script_read_claude\projects\<film>\work\`).
- Scene order comes from the ODG only (sides are used for speakers). Day 5 ODG said 23·4, sides and
  app 4·23 — asked Ana which wins when they differ; no answer yet.
- ODG reader: a location can swallow the next column ("PIANO NOBILE (2°) STAND BY:").
- GitHub Actions: checkout@v4 / setup-python@v5 warn about Node 20 (harmless for now).
