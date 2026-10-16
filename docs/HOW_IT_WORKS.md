# How soundcheck works (a map for Ana)

## The big idea
- The **app** (these files) is public on GitHub Pages. It contains no film data.
- The **data** is JSON files in the private repo `soundcheck-data`, one folder per film.
  You can open and read them on github.com: one preset file per scene, one row per line.
- Each device keeps its own copy (one small database per film), so it works with no signal.
- **Saving** a scene stores it on the device at once and puts it in the *outbox*. When there is
  signal, `sync.js` uploads the outbox (one commit) and downloads what other devices changed.
- If two devices changed the same scene, the app asks which version to keep.

## Where things are
| I want to change… | Open this file |
|---|---|
| A colour, a size, the font | `app.css`, the `:root` block at the top |
| Dark screen (Projects → Screen) | dark colours at the end of `app.css` (`:root[data-theme="dark"]`); switch `src/theme.js`, `src/parts/theme-switch.js` |
| How a pill (character / TX / lav / speaker) looks | `src/parts/pills.js` + section 5 of `app.css` |
| The scene table (#12 bar and its rows) | `src/parts/scene-table.js` |
| Week / day banners, scene chips | `src/parts/banners.js` |
| The day pills (Schedule and Cues: green = finished, chosen day centred) | `src/parts/day-strip.js` |
| Icons (Cues = speech bubble; the mic = the Mics department only) | `src/parts/icons.js` |
| The Schedule screen (Day / Week / All film) | `src/screens/schedule.js` |
| Scene lookup | `src/screens/scenes.js` |
| Kit (characters, TX, lavs) | `src/screens/kit.js`; its form `src/parts/item-form.js`; saving `src/kit-editing.js` |
| Films on this device, import, backup | `src/screens/projects.js` |
| The exported images | `src/export/image.js` (layout), `src/export/draw.js` (shapes) |
| What a project contains | the comment at the top of `src/model.js` |
| What happens when a button is pressed | the actions in `src/state.js` |
| Editing a scene (draft, save) | `src/editing.js`, the editor table `src/parts/scene-editor.js` |
| The picker that slides up | `src/parts/picker.js` |
| Warnings (TX twice), "same as other scenes today", preferred TX/lav | `src/preset-rules.js` |
| Uploading / downloading, "Keep mine" | `src/sync.js` (logic), `src/store/github.js` (talks to GitHub) |
| How a film is split into files | `src/store/repo-files.js` |
| The films list in Projects, downloading a film the first time | `src/films.js` |
| Week / all-film images | `src/export/schedule-images.js` |

## Recipes
**Change a colour:** edit its token in `app.css` (e.g. `--accent: #111827;`). Save, refresh.

**Try a change on the laptop:** in `D:\sound_check` run `npm run serve`, open
http://localhost:8321, connect in Projects and download the film.

**After changing any app file:** bump `VERSION` in `sw.js` (e.g. `soundcheck-v2`), otherwise
installed devices keep showing the old version.

**Fix something by hand:** edit the JSON file on github.com (e.g. `presets/12.json`), commit.
Devices pick it up at their next sync.

**New film:** make a folder `projects/<film-id>/` in soundcheck-data with the same files as an
existing film (the analyzer pipeline will write these). It appears in Projects on every device.

## Production emails → proposals (pipeline/)
Runs in the cloud (GitHub Actions), in Python; the laptop can run it too. Nothing in the film changes until you accept it in the app.

| Step | File |
|---|---|
| Download ODG + sides from Gmail (app password in `~/.soundcheck/gmail.txt`) | `pipeline/fetch_mail.py` |
| Read the ODG: day, times, scenes, cast, department notes | `pipeline/read_odg.py` |
| Read the sides: who speaks in each scene | `pipeline/read_sides.py` |
| Compare with the film (date, times, scenes, cast, speakers) | `pipeline/compare.py`, `pipeline/compare_mics.py` |
| Write `proposals/odg-N.json` | `pipeline/propose.py` |
| Read a PDL + scaletta (all days, scenes, cast) | `pipeline/read_pdl.py` |
| PDL → a whole review from today on: `proposals/pdl-<date>.json` | `pipeline/propose_pdl.py` |
| All of it, then commit + push | `python pipeline/run.py D:/sound_check_data/projects/<film>` |
| In the cloud: started minutes after an email arrives (Gmail trigger), and every 30 min 04–10 / 17–24 Rome as a backup; one run at a time | `.github/workflows/emails.yml` in soundcheck-data |
| Gmail trigger: Google checks the mailbox every 10 min and starts the robot for a new ODG / sides / PDL | `pipeline/gmail-trigger.gs` (Apps Script in the production mailbox, see below) |
| Sides in a separate email ("Re: … ODG #7") matched to their day | `sides_by_day` in `pipeline/propose.py` |
| ODG + sides PDFs filed as `docs/day-N/odg.pdf`, `sides.pdf` | `file_documents` in `pipeline/run.py` |
| New ODG → notification "🎙 D18 lavs ready" (phones with 🔔 on) → tap opens `#lavs-18` → Share the mic list (WhatsApp / Save Image); sent before review, the screen says when it's a draft (Ana, 12 Oct) | `tell_lavs` in `pipeline/run.py`, `src/screens/lav-share.js` |
| Official PDFs not already kept as a current copy (outdated/corrected ODGs and sides, older PDLs, scalette, maps), kept forever in `docs/archive/<date>_<subject>_<id>/`, no duplicates (repo only, not synced to the phone; Ana, 12 Oct) | `file_archive` in `pipeline/run.py` |
| ODG notes: visible on the slate only what can impact sound (🔊 notes, and the sound fragments of other departments: shots, engines, generators, water, screams…); 🎬 director / 👗 costume notes → "ⓘ more info"; the rest skipped. "STAND BY:" heading → the scenes under it get "⏸ stand-by on day N" | `note_kind` / `AUDIBLE` in `pipeline/compare.py`, `read_scene_table` in `pipeline/read_odg.py`; scenes.json `notes` (visible) + `info` (more info) |

📄 ODG / 📄 Sides buttons on each day: the PDFs of every day (yesterday on first) are downloaded at sync
(`downloadDocuments` in `src/sync.js`), kept on the device (`src/store/local.js`) and shown by
`src/screens/document.js` with pdf.js (`vendor/pdfjs`).

In the app: the 📬 banner → accept or reject each change (`src/screens/proposal.js`,
`src/proposals.js`, and `src/proposal-rules.js` which applies a change).
Which emails belong to a film: `projects/<film>/inbox.json` in the data repo.

### Email robot trigger (Apps Script) — setup once
1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate: repository access **only
   soundcheck-data**, permissions **Actions: Read and write** + **Variables: Read and write**.
2. script.google.com, logged in as the production mailbox → New project → paste `pipeline/gmail-trigger.gs`.
3. ⚙ Project settings → Script properties → add `GITHUB_TOKEN` = the token.
4. Choose `setup` in the function menu → Run → allow access. This creates the 10-minute timer.
5. ⏰ Triggers → the timer → ✎ → Failure notification: **Notify me immediately**.
Check: Executions (☰ list icon) shows each check; GitHub → Actions shows the runs it started.

### Automatic alarms (no tap) — setup once
Ana, 9 Oct: she didn't tap ⏰ and the alarm wasn't set. The iPhone now asks the robot every evening.
- The robot (`doGet` → `alarmAnswer` in `pipeline/gmail-trigger.gs`) answers `06:00;06:45` (wake;leave, the
  same sums as the app's ⏰) when the next morning is a shooting day, or `none` (weekend, day off). Before noon
  "next morning" = today; else tomorrow — so Friday's run says `none` and Sunday's sets Monday. An ODG not yet
  reviewed counts already. Tested with a fake Google on the real LBE data (Fri/Sat → none, Sun → 05:30;06:15).
- In Apps Script: paste the new `gmail-trigger.gs` → Script properties → `ALARM_KEY` = a long random word →
  Deploy → New deployment → ⚙ Web app → Execute as **Me**, Who has access **Anyone** → copy the URL.
  Test in Safari: `<URL>?key=<ALARM_KEY>` shows `none` or the times. (A new version of the script needs
  Deploy → Manage deployments → ✎ → Version: New, or the URL keeps the old code.)
  12 Oct 2026: alarms came out 10 min late (06:45;07:30, Ana's own call) because a second "New deployment"
  made a new link (new code) while the shortcut kept the first (frozen before ride_with).
  The shortcut now uses the second link. Never "New deployment" again — always ✎ → New version on that one.
- Shortcut **soundcheck auto alarms** (Shortcuts app):
  1. **Get Contents of URL** (Obter Conteúdo do URL): `<URL>?key=<ALARM_KEY>`
  2. **If** Contents of URL **contains** `;` → **Run Shortcut** (Executar Atalho) *soundcheck alarms*, input =
     Contents of URL → **Show Notification** "⏰ " + Contents of URL
  3. **Otherwise** → **If** Contents of URL **is** `none` → **Find Alarms** (label contains `soundcheck`) → **If**
     Alarms **has any value** → **Delete Alarms** → End If → **Show Notification** "No shooting tomorrow — no alarm"
     → **Otherwise** → **Show Notification** "⚠️ The robot didn't answer — alarms kept. Check ⏰ in the app" → End If
  Alarms are deleted ONLY on a clear `none`: a failure answers `error` (robot) or an error page (Google), and
  no internet stops the shortcut at step 1 — the alarms already set stay. (Ana, 10 Oct: afraid a second run
  could erase a good alarm.) Without the "has any value" check, Delete Alarms with nothing found asks which
  of ALL alarms to delete.
- Automations (Automação → + → Time of Day): **20:00** daily and **22:30** daily, **Run Immediately**, each
  runs *soundcheck auto alarms*. Running twice is harmless (old soundcheck alarms are deleted first); the
  second catches a late ODG.
- **Riding with someone** (Ana, 11 Oct: she rides with a colleague from another department; the app keeps
  her own call, the alarms follow the colleague's):
  settings `commute.ride_with` = the name as printed in the ODG's TROUPE list. The pipeline writes everyone's
  call per date to `calls.json` (`file_crew_calls` in `pipeline/run.py`, from `docs/day-<n>/odg.pdf`); wake,
  leave, sleep (app card, robot answer, bedtime and "Tomorrow" pushes) start from THAT call, Ana's own call
  stays everywhere else. The colleague leaves 1:15 before their call (`meet_before_call` 75), Ana needs 30–45
  min to reach them. No ODG yet → Ana's call − `ride_gap_if_unknown` (40, the widest gap in ODGs 1–16).
  Same sums in `hours-rules.js` → `rideCall`, `gmail-trigger.gs` → `rideStart`, `wake_plan.py` → `ride_call`.
- Ana, 11 Oct, 20:00 run failed: "requires privacy permissions that cannot be granted while the device is
  locked". Each permission (internet to the robot's URL, alarms, notifications, the inner shortcut) must be
  allowed once by hand: run *soundcheck auto alarms* (and *soundcheck alarms*) from the Shortcuts app with the
  phone unlocked → **Always Allow** on every question. After that the locked-phone runs work.

- **On the ODG's arrival** (Ana, 10 Oct): Script property `ALARM_MAIL` = Ana's own address → at every
  10-minute check the robot works out the answer and, when it changes, emails itself "soundcheck alarms"
  (`checkAlarmChange`; never on `error`; last sent in `ALARM_LAST`). Simulated Sat→Tue on real data: one email
  per day at 12:00 (the answer moves to the next day) plus one per ODG change. iPhone: the Gmail account in the
  Mail app (Fetch every 15 minutes, Mail notifications off for it) + automation **Email** — subject contains
  `soundcheck alarms` → Run Immediately → *soundcheck auto alarms*. The 20:00 / 22:30 runs stay as the net.

### ✉ badge in the app (emails checked · Check emails now)
The top bar shows when Gmail was last checked (variable `LAST_GMAIL_CHECK`, set by the Gmail trigger at
every check); orange after 30 minutes without a check or when the robot's last run failed. Tap it:
last check, last robot run, **Check emails now** (starts the robot, waits, syncs).
Files: `src/email-robot.js`, `src/parts/email-robot.js`, `emailRobot` / `startEmailRobot` in `src/store/github.js`.
The app's GitHub key needs **Actions: Read and write** and **Variables: Read-only** besides Contents.

## 🎙 Cues (learn a scene's lines)
| What | File |
|---|---|
| Who says what, from sides / script PDFs | `pipeline/read_lines.py` → `pipeline/cue_lines.py` writes `lines/sides/<scene>.json`, `lines/script/<scene>.json` |
| New script version (by hand) | `python pipeline/cue_lines.py <film folder> "<script.pdf>" "<version>"` |
| Which lines a scene shows (sides → script → base scene for 7fin) | `src/cues-rules.js` |
| The full-screen mode (one speech per page, scrolls when long) | `src/screens/cues.js` + section 11 of `app.css` |
| One phrase per line (after , ; : . ? ! …) | `src/cues-phrases.js` |
| Scene Map: colour strip, beats, each line's last words (tap a line → the whole line + Learn from here); made from the same lines, so ✎ edits show at once | `src/cues-map-rules.js`, `src/screens/cues-map.js` |
| Scene Map auto-scroll (pinned at the top with the colour strip): ▶/■, speed − / + (remembered), a touch pauses, carries on after you let go | `src/parts/auto-scroll.js` |
| Scene Timeline (Pro Tools-style): blocks back to back in the speakers' colours, width ∝ speaking time (syllables at ~5.5/s at 1×, pauses after , . ? ! … and a breath when the speaker changes) (long speeches capped "⋯" so the next lines stay in view), fixed ▼ cursor, ▶ / speed 0.5–2× / drag to scrub / tap to jump; above the track, the whole scene as a script scrolling by itself like Spotify lyrics (name centred, dialogue left-aligned with an indent; said lines fade, the current line turns black word by word; scroll by hand / tap a line to jump); the track + controls are the play bar; Aa in the top row | `src/cues-timeline-rules.js`, `src/screens/cues-timeline.js`, `src/parts/scene-script.js` |
| ✎ Changed on set (edit / delete / + New line before or after, undo all) → `lines/set/<scene>.json`, wins over sides and script; the pipeline never writes it; newer paper is offered (Use it / Keep my changes) | `src/cues-editing.js`, panel `src/parts/cue-line-editor.js` |

## 🔊 Sound breakdown (dificultômetro + lav warnings)
| What | File |
|---|---|
| One file per scene: `sound/<scene>.json` = level 1–5 (MOS · AMB · EASY · MEDIUM · HARD, Ana's colours), reason, flags, notes, warnings `[{ char_id, kind, text }]` | data repo |
| Levels, flags, warning kinds, suggested level (Ana's rules), lav checks | `src/sound-rules.js` |
| The thin bar under each slate + the 🔊 panel; warnings under mic rows | `src/parts/sound-bar.js`, saved by `src/sound-editing.js` |
| THE scene number pill, tinted by the level — one component used everywhere (change it once) | `src/parts/scene-pill.js` (`.scene-pill` in `app.css`) |
| Lav picker shows the character's warning; "No lav" + a lav → Save asks "Save anyway" | `src/parts/picker.js`, `src/parts/scene-editor.js` |
| Printed on the day / scene images | `drawSound` in `src/export/image.js` |
| First fill from the AT: a proposal (`proposals/sound-at.json`, change type `set_sound`) | `projects/la-buona-educazione/work/build_sound_proposal.py` in script_read_claude |

## 🎧 IFB department (Mics | IFB switch at the top)
| What | File |
|---|---|
| Crew, receivers, headphones, the IFB list (one for the film) | `ifb/crew.json`, `ifb/receivers.json`, `ifb/headphones.json`, `ifb/list.json` in the data repo |
| The list: OUT / ✓ back, still out, edit who has what | `src/screens/ifb-list.js`, actions in `src/ifb-editing.js`, picker `src/parts/ifb-picker.js` |
| Crew lookup, Call / WhatsApp, 🚨 Emergency (who comes first) | `src/screens/ifb-crew.js`, rules in `src/ifb-rules.js` |
| Crew on each ODG → new people proposed next to their role (numbers shift, IFB list follows; nobody removed; PERSONALE AGGIUNTO = daily) | `pipeline/read_crew.py`, `pipeline/compare_crew.py`; applied by `add_crew_member` in `src/proposal-rules.js` |
| IFB Kit (same forms as the mic Kit) | `src/screens/ifb-kit.js` (uses `Section` from `src/screens/kit.js`) |

## 🔋 Batteries (Gear → Batteries, v144; estimates, chargers, TX pills v145)
Every battery of the film by group (AA, NP-F970…), always green / yellow / red (Ana, 12 Oct: "charged are green,
used are red"). Tap a battery: Full · Charging (minutes on that charger) · In use (TX 7, B1…) · Empty; its clock
starts. In use: green, yellow under 30% of the group's estimated life, red under 10%. Charging past its time: "done?".
v145 (13 Oct, Ana: "why haven't you done this?"):
- **🔋 on the TX pills** (Mics scene tables, Kit): the countdown of the battery marked In use in that TX.
- **Estimate in a TX**, aiming short ("end before!"): the group's minutes for that TX model (group sheet, by model)
  × the battery's Life % (old ones less) · no more than its last 3 runs that ended Dead/Low in that model (Dead
  counts 10% shorter; "Still OK" teaches nothing) · −15% if the TX is in a scene of ≥ 3 pages today (the AT's rule).
  The battery sheet shows who wears it today (character + actor) and the sum (e.g. "ZMT4.5 6:00 × 90% · long scene #12 −15%").
- **Learning**: taking a battery out of a TX asks "How did it end? Dead · Low · Still OK" (optional); kept in `runs`.
- **Chargers** ("+ Charger": name, group it charges, slots, minutes for a full charge). Charging asks which charger;
  minutes = this time's own, else the charger's, else the group's. Each group shows its chargers with load (🔌 5/8).
- Data: "Video batteries" = the 5 Oyomba NP-F970 (g284), 5 h to charge. v146: a group's minutes can be per place that
  isn't a TX ("Mars 4K TX" 4:00, "Mars 400S Pro TX" 3:10, "Mars 400S Pro RX" 5:00 — ≈ 35 Wh usable ÷ the draw in the
  manual / retailers' specs, aiming short); those places are offered under "In".
- v147 (13 Oct, Ana: "for all equipment that has batteries, the consumption it has per hour"; "use always what they
  have in the label … leave fields for my practical observations"): **Power draw** (under the groups) = what each
  model draws in W (manuals / makers, "?" when not published), batteries at once, battery type. A group has its
  battery type and the **Wh on its label** → the IDEAL minutes per model = Wh × batteries ÷ W ("label 6:47"). The
  group sheet asks the minutes **seen in practice** per model taking its battery type; those win over the label.
  Order: seen > label > the group's minutes; then the battery's Life %, its Dead/Low runs, the long-scene −15%.
- v148: battery "internal" (not swapped — Ana, 13 Oct: the Ambient TC boxes) shows the maker's hours on a full charge
- v149 (Ana, 13 Oct): the mic table on SWIPE PAGES — the Character pinned (compact), every other column in one ordered list (scene-table.js COLUMNS) cut into pages by the phone width, dots top right. Order: TX (+MHz) · Speaks · Battery · Lav · Lav acc. · TX acc. · Position. The Speaks ⇄ Acc. swap and the 🔋 tag under the TX pill are gone ("never print under a pill"). BATTERY column (battery-cell.js): OFF until tapped while rigging → tap a battery number (the groups that fit the TX model, best first) or "ON, no number" (gear/batteries.json tx_on); ON = countdown big + change time small, green/yellow/red; tap again = how did it end (Dead/Low/Still OK) + the next battery, or OFF; the ended battery goes to Empty. A timer older than 16 h shows OFF. Acc. list split by type: strap/pouch/pocket/belt = TX acc., the rest = Lav acc. Position = free text per scene row (suggestions: chest, collar, hair…). Images ask "Image for: Sound mixer · Sound assistants" (parts/image-for.js): mixer = Character · TX (no MHz) · Lav · Speaks; assistants = Character · TX+MHz · Change at · Lav · Lav acc. · TX acc. · Position (file rig_…png).
- v150 (Ana, 13 Oct): IFB receivers get a BAND field (ifb/receivers.json `band`, e.g. "Cw 718–790") — the EK1039s come in 2 frequency groups; shown in the IFB Kit and in the receiver picker. No serial numbers needed.
- v151 (Ana, 13 Oct): Gear → Manuals grouped by BRAND then CATEGORY (gear/manuals.json `category`): one category → "Schoeps — Microphones" on the brand line; several → a small sub-heading each (Sennheiser: Headphones, Wireless…). Brands and categories A–Z. Also v150: Hours keeps a worked day whose scenes a later ODG moved away (hours/<day>.json keeps call + odg_wrap).
  (Lockit 17 h, LockitBT 14 h, NanoLockit 25 h, Tentacles 50 / 35 h).
- v153 (Ana, 16 Oct): read aloud removed — the app never speaks (no `src/read-aloud.js`, no 🔊 in Cues or the
  Timeline); an old `voices` key in settings.json and `voice` in characters.json are ignored.
No notifications yet (after the aesthetics, Ana 12 Oct).
| What | File |
|---|---|
| Groups and batteries, state and since | `gear/batteries.json` in the data repo |
| Colours, countdowns, counts, estimates, learning | `src/battery-rules.js` (tests: `tests/batteries.test.js`) |
| 🔋 next to the TX pills | `src/parts/battery-tag.js` (in `parts/scene-table.js`, `screens/kit.js`) |
| Saving | `src/battery-editing.js` |
| The screen and its sheets | `src/screens/gear-batteries.js` (sheet from `src/parts/gear-form.js`), styles `.battery*` in `app.css` |

## Crew link (Projects → Share with crew; plan: `docs/CREW_SHARING.md`)
One link per crew person opens the film on their phone, with no GitHub account. The link holds owner,
repo, branch, the film's crew key, the person's name and the film folder, after `#join=` (never sent anywhere).

| What | File |
|---|---|
| Making / reading the link, "is this a crew phone?" | `src/crew-link.js` (tests: `tests/crew.test.js`) |
| Share with crew (crew key + name → Copy link; key and names stay on Ana's device only) | `src/parts/crew-share.js`, shown by `src/screens/projects.js` |
| Opening a link: connect as crew, clear the address bar, download the film | `joinFromLink` in `src/crew-join.js` (from `src/main.js`) → `joinAsCrew` in `src/state.js` → `downloadCrewFilm` in `src/crew-join.js` |
| No signal when joining: "the film will download as soon as you're online", remembered on the phone and tried again (signal back, app in front, next start) | `src/crew-join.js` (tests: `tests/crew-screens.test.js`) |
| Finding the film by its folder (`film.json`); a crew phone lists only that film | `readFilm` in `src/store/github.js`, `loadFilmList` in `src/films.js` |
| Crew phones never commit (the outbox stays on the phone) | `upload()` in `src/sync.js` |

A crew connection is `{ …, device: name, role: 'crew', name, folder }`; no role = Ana's devices (as before).

## Crew suggestions (crew sharing step 3)
On a crew phone, Save works as usual (the file goes into the outbox), but sync never commits:
`syncAsCrew` in `src/sync.js` runs, in this order:
1. **Closed suggestions** (`takeBackClosed`): the phone looks at the repo's issues; for each of its own
   suggestions now closed it drops its version (out of the outbox) so the film's version is downloaded
   again in this same sync, and writes a line in its log: approved / not approved (+ reason) / closed,
   read from the last comment ("approved", "not approved: reason").
2. **Download** as usual, except: a file the phone has changed is never overwritten and never becomes a
   conflict while it is proposed. The version each change started from is remembered (`noteBases`).
3. **Send** (`sendSuggestions`): each changed file not sent yet → one GitHub issue "Suggestion from
   Davide: Gear: + Sandbag". The body has the lines for people, then a ```json block with the marker
   `"soundcheck": "crew-suggestion"`, the film folder, the file, the version it started from and the
   changes. Changed again → a new issue, the old one is closed "Replaced by #n". Changed back to the
   film's version → nothing to suggest, out of the outbox. Label `crew-proposal` (may be dropped by
   GitHub: suggestions are recognised by the marker, never by the label).

The top badge shows "● n proposed" for files already sent, "● n waiting" for those not sent yet.
Bookkeeping in the film on the phone: `project.crewSuggestions = { base, sent, log }`
(`project.crew` is the IFB crew list).

| What | File |
|---|---|
| What changed in a file (by id, by scene_id in the schedule, by key, or the whole file), applying it to the film's current data (clashes), the issue text and reading it back, the closing comment | `src/crew-changes.js` (tests: `tests/crew-changes.test.js`) |
| The lines for people ("Scene 12: preset changed", "Characters: Ines — lav changed") | `src/crew-describe.js` |
| Closed → back to the film's version; sending; the "proposed" count | `src/crew-sync.js` (tests: `tests/crew-sync.test.js`, fake GitHub) |
| Issues on GitHub (create, list, comment, close) | `src/store/github.js` |

Hours (`hours/…`) and wrap alerts (`push/…`) are personal: on a crew phone they stay on the phone, are
never sent and never counted as "waiting" or "proposed" (`staysOnPhone` in `src/crew-sync.js`).

## Approving crew suggestions (crew sharing step 4)
On Ana's own devices only (crew phones unchanged). After the normal sync (download, upload, PDFs),
`ownerInbox` in `src/crew-inbox-sync.js` (called by `syncAsOwner` in `src/sync.js`) runs inside a try/catch, so it can never stop or fail the sync:
1. **Decisions** taken on this device are sent: a comment `approved` or `not approved: <reason>` on the
   suggestion's issue, then it's closed. An approval is sent only once its file has been uploaded (not in
   the outbox any more); a "not approved" goes at the next sync. With no signal they wait. Crew phones read
   these words, so they always start with "approved" / "not approved" and never name anyone.
2. **Open suggestions** of the open film are listed (only the newest per person and file: an older one for
   the same file counts as replaced). A key not allowed to read issues (401/403) → an empty list, no message.

The list lives in `state.crewSuggestions` (not in the film data). A 📬 banner per person, like the email
one: "Davide suggests 2 changes · 2 to review ›" → screen `crew-suggestions`: each suggestion in plain
lines with ✕ Don't approve (optional reason) / ✓ Approve. **Approve** reads the version it started from,
puts the changes into the film as it is NOW (Ana's later edits of other records stay) and saves like a
normal edit (outbox → upload). If the same record changed meanwhile it shows "Changed meanwhile: …" and
needs "✓ Approve anyway". The upload's commit message ends "— proposed by Davide, approved".
Decisions not sent yet are kept on this device only: localStorage `sc_crew_decisions`
(`[{ issue, decision, reason, by, path, film }]`), so they survive a reload.

| What | File |
|---|---|
| Listing (newest per person and file), sending decisions, the closing words, the commit message ending | `src/crew-inbox.js` (tests: `tests/crew-approve.test.js`) |
| Approve / Don't approve (the actions) | `src/crew-approve.js` |
| Decisions waiting on this device; suggestions grouped by person | `src/crew-decisions.js` |
| The banner and the screen | `src/screens/crew-suggestions.js`, registered in `src/main.js` |

## Crew screens (crew sharing step 5)
**Hidden on crew phones** (Ana's personal setup, not the film's): `crewHides(connection, part)` in
`src/crew-link.js` with the list `PERSONAL_PARTS`: 🔔 Wrap alerts and the wake-up plan / ⏰ Set alarms card
(`src/screens/hours.js`), Help → Alarms and the wrap alerts line of Help → Wrap hours (`src/screens/help.js`).
(Since step 6 the Hours screen, `#hours` and the ⏱ wrap clock show on crew phones: see "Crew hours".)
Ana's devices see everything as before.

**My suggestions** (Projects, crew only, `<details class="more">`): what waits first ("Waiting for approval",
"Feedback waiting to send"), then the answers newest first ("Change approved", "Change not approved — <reason>",
"Closed", "Feedback sent"). Never a name. Each sent suggestion now also keeps its lines
(`crewSuggestions.sent[path].lines`).

**Feedback** (crew only): Projects → "Enjoyed soundcheck? Share some feedback" → stars 1–5, What helped, What
annoyed you, Anything else. Send keeps it on the phone (localStorage `sc_crew_feedback`); the crew sync sends it
(`sendWaitingFeedback`, never throws) as an issue "Feedback from Davide": readable lines + a JSON block
`{ soundcheck: 'crew-feedback', version: 1, film, by, stars, helped, annoyed, text, at }`, label `crew-feedback`
(not trusted). Then a "Feedback sent" line in the film's `crewSuggestions.log` (`kind: 'feedback'`).
Offered once by itself: from 3 days before the film's last shooting day (to a week after), a banner "The film
is wrapping. Enjoyed soundcheck? Share some feedback ›"; the film is remembered in `sc_feedback_offered` at once.

**Ana's side**: the owner sync also lists open feedback of the film (`state.crewFeedback`): a 📬 banner
"Feedback from the crew · n to read ›" → a Feedback section on the `crew-suggestions` screen; ✓ Mark as read
comments "thanks" and closes the issue. **Remove / Restore** next to each name in Projects → Share with crew
(localStorage `sc_crew_removed`): a removed name's suggestions and feedback are not shown and never closed
(their link still opens the film; to lock someone out, make a new crew key).

| What | File |
|---|---|
| What a crew phone hides | `crewHides` in `src/crew-link.js` |
| Lists kept on this device only (crew key, names, removed names, waiting feedback, offered) | `src/crew-device.js` |
| Feedback issue, reading it back, when to offer it, sending at sync | `src/crew-feedback.js` |
| The words of "My suggestions" | `src/crew-messages.js`; shown by `src/parts/crew-log.js` |
| Feedback form and the wrap offer | `src/parts/crew-feedback-form.js` |
| Owner sync: decisions, suggestions, feedback, removed names; Mark as read | `src/crew-inbox-sync.js`, `src/crew-inbox.js` |
| Tests | `tests/crew-screens.test.js` (fake GitHub) |

## My call (crew sharing step 6)
Every device (Ana's and crew) chooses in Projects → **My call** (segmented, like Screen): **General crew call**
(the default: exactly as before) or **Personal call** + "Your name as printed on the call sheet". Kept on the
device only: localStorage `sc_my_call` = `{ mode: 'general' | 'personal', name }` → `state.myCall`
(`rememberMyCall` in `src/state.js`).
`myCallFor(project, day, setting)` → `{ call, source: 'general' | 'personal' | 'fallback', note }`: Personal
looks the name up in `calls.json` (`project.crewCalls[date]`), matching with no capitals, accents or extra
spaces (`sameName`, also used by the wake plan's `ride_with`). Not on that day's sheet → the crew call, source
`fallback`, note "Your name wasn't on this day's call sheet: using the crew call." (a muted line on Hours).
`withMyCalls(project, setting)` gives the Hours screen, the ⏱ wrap clock / question and the timesheet a copy of
the film where each day's call is "my call" (General → the very same film). The wake plan (Tomorrow card)
starts from my call; `ride_with` still follows the colleague's call. The Schedule always shows the crew call.
Nothing is saved from it on crew phones.

**The robots follow Ana's My call (v156).** On Ana's own devices (not crew), picking Personal with a name
also saves it in the film's `settings.json` → `commute.my_name` (`followMyCall` in `src/hours-editing.js`,
outbox + sync like any settings change); picking General removes `my_name`. Only for a film that already has
a `commute` (a wake-up plan): the app never adds one just for the name. The last choice on any of Ana's
devices wins. The robots then use: her name found in that day's `calls.json` (same matching: no capitals,
accents or extra spaces) → her own call; else the day's general call. `ride_with` unchanged (it starts from
the colleague's call; not known → 40 min before HER call). Same rule in three places:
`wake_plan.py` → `own_call` (the "Tomorrow" push, `tell_tomorrow` in `run.py`), `gmail-trigger.gs` →
`ownCall` (bedtime and the automatic alarms) and the app (`myCallFor` + `wakePlan`). Tests with the same fixed
times on both sides: `tests/robots-my-call.test.js` and `tests/test_wake_plan.py`.
**After changing `gmail-trigger.gs`:** paste it in Apps Script, save, then Deploy → Manage deployments →
✎ → Version: **New version** (never "New deployment"), or the alarms link keeps the old code.

| What | File |
|---|---|
| The rules (`myCallFor`, `withMyCalls`, `sameName`, `daysNotOnSheet`) | `src/my-call.js` |
| Projects → My call | `src/parts/my-call-switch.js` |
| Saving it for the robots (`followMyCall`, `robotsMyNameAfter`) | `src/hours-editing.js` |
| Tests | `tests/my-call.test.js`, `tests/robots-my-call.test.js`, `tests/test_wake_plan.py` |

## Notifications per person (v156)
Each `push/<phone>.json` (🔔 Wrap alerts, `pushEntry` in `src/parts/wrap-alerts.js`) also says whose phone it
is: `person` (the link's name, else the device name) and `role` (`owner` or `crew`). A file without `role`
(older phones) counts as Ana's. `send(film, title, body, url, tag, audience='owner')` in
`pipeline/send_push.py`: `owner` → only Ana's phones (wrap question, bedtime, Tomorrow, lavs ready — every
current caller); `all` → every phone (for film alerts later: change approved, new call sheet).
Command line: `send_push.py <film> "<title>" "<text>" [url] [tag] [owner|all]`.
(Crew phones don't send their push file yet: `push/…` stays on a crew phone, `staysOnPhone`.)
Python tests: `python3 -I -m unittest discover -s tests -p "test_*.py"` (no network; `tests/test_send_push.py`).

## Crew hours (crew sharing step 6)
Hours are per person. On a crew phone the Hours screen, `#hours` and the ⏱ wrap clock / "Did today finish on
time?" show again, counting the person's OWN hours (from My call). Their `hours/<day>.json` stay in the outbox
on the phone, never sent (`staysOnPhone`). The film's `hours/` and `push/` files are Ana's: the crew download
skips them (`download()` in `src/sync.js`), and `ownHoursOnly` in `src/crew-sync.js` keeps only hours / wrap
alerts that are in the phone's outbox, so a copy of Ana's hours downloaded by an older version is dropped at
the next sync. Hours → **📊 Export my timesheet**: the same Excel as Ana's, with only the person's block
(`timesheetPeople(project, name)` in `src/export/timesheet.js`; their job from the IFB crew list when the name
is there). Still hidden on crew: wake plan / alarms, 🔔 wrap alerts, Help → Alarms.
