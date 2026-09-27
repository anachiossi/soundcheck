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
**Change a colour:** edit its token in `app.css` (e.g. `--accent: #1e3a8a;`). Save, refresh.

**Try a change on the laptop:** in `D:\sound_check` run `npm run serve`, open
http://localhost:8321, connect in Projects and download the film.

**After changing any app file:** bump `VERSION` in `sw.js` (e.g. `soundcheck-v2`), otherwise
installed devices keep showing the old version.

**Fix something by hand:** edit the JSON file on github.com (e.g. `presets/12.json`), commit.
Devices pick it up at their next sync.

**New film:** make a folder `projects/<film-id>/` in soundcheck-data with the same files as an
existing film (the analyzer pipeline will write these). It appears in Projects on every device.

## Production emails → proposals (pipeline/)
Runs on the laptop, in Python. Nothing in the film changes until you accept it in the app.

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
| In the cloud: every 30 min, 17:00–24:00 Rome | `.github/workflows/emails.yml` in soundcheck-data |
| ODG + sides PDFs filed as `docs/day-N/odg.pdf`, `sides.pdf` | `file_documents` in `pipeline/run.py` |

📄 ODG / 📄 Sides buttons on each day: the PDFs of yesterday on are downloaded at sync
(`downloadDocuments` in `src/sync.js`), kept on the device (`src/store/local.js`) and shown by
`src/screens/document.js` with pdf.js (`vendor/pdfjs`).

In the app: the 📬 banner → accept or reject each change (`src/screens/proposal.js`,
`src/proposals.js`, and `src/proposal-rules.js` which applies a change).
Which emails belong to a film: `projects/<film>/inbox.json` in the data repo.

## 🎙 Cues (learn a scene's lines)
| What | File |
|---|---|
| Who says what, from sides / script PDFs | `pipeline/read_lines.py` → `pipeline/cue_lines.py` writes `lines/sides/<scene>.json`, `lines/script/<scene>.json` |
| New script version (by hand) | `python pipeline/cue_lines.py <film folder> "<script.pdf>" "<version>"` |
| Which lines a scene shows (sides → script → base scene for 7fin) | `src/cues-rules.js` |
| The full-screen mode | `src/screens/cues.js` + section 11 of `app.css` |
