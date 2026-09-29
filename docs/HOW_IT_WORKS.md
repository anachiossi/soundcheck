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
| How a pill (character / TX / lav / speaker) looks | `src/parts/pills.js` + section 5 of `app.css` |
| The scene table (#12 bar and its rows) | `src/parts/scene-table.js` |
| Week / day banners, scene chips | `src/parts/banners.js` |
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
| Gmail trigger: Google checks the mailbox every 10 min and starts the robot for a new ODG / sides / PDL | `pipeline/gmail-trigger.gs` (Apps Script in sound.chiossi@, see below) |
| Sides in a separate email ("Re: … ODG #7") matched to their day | `sides_by_day` in `pipeline/propose.py` |
| ODG + sides PDFs filed as `docs/day-N/odg.pdf`, `sides.pdf` | `file_documents` in `pipeline/run.py` |

📄 ODG / 📄 Sides buttons on each day: the PDFs of every day (yesterday on first) are downloaded at sync
(`downloadDocuments` in `src/sync.js`), kept on the device (`src/store/local.js`) and shown by
`src/screens/document.js` with pdf.js (`vendor/pdfjs`).

In the app: the 📬 banner → accept or reject each change (`src/screens/proposal.js`,
`src/proposals.js`, and `src/proposal-rules.js` which applies a change).
Which emails belong to a film: `projects/<film>/inbox.json` in the data repo.

### Email robot trigger (Apps Script) — setup once
1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate: repository access **only
   soundcheck-data**, permissions **Actions: Read and write** + **Variables: Read and write**.
2. script.google.com, logged in as sound.chiossi@ → New project → paste `pipeline/gmail-trigger.gs`.
3. ⚙ Project settings → Script properties → add `GITHUB_TOKEN` = the token.
4. Choose `setup` in the function menu → Run → allow access. This creates the 10-minute timer.
5. ⏰ Triggers → the timer → ✎ → Failure notification: **Notify me immediately**.
Check: Executions (☰ list icon) shows each check; GitHub → Actions shows the runs it started.

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
