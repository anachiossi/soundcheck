# How soundcheck works (a map for Ana)

## The big idea
- The **app** (these files) is public on GitHub Pages. It contains no film data.
- Each **film** is one project file (`<film>.soundcheck.json`). On a device, every film gets its
  own little database, so a new film never erases an old one.
- The app always reads from the device, so it works with no signal. "Update from Sheets"
  downloads fresh data when there is internet.

## Where things are
| I want to change… | Open this file |
|---|---|
| A colour, a size, the font | `app.css`, the `:root` block at the top |
| How a pill (character / TX / lav / speaker) looks | `src/parts/pills.js` + section 5 of `app.css` |
| The scene table (#12 bar and its rows) | `src/parts/scene-table.js` |
| Week / day banners, scene chips | `src/parts/banners.js` |
| The Schedule screen (Day / Week / All film) | `src/screens/schedule.js` |
| Scene lookup | `src/screens/scenes.js` |
| Kit (characters, TX, lavs) | `src/screens/kit.js` |
| Films on this device, import, backup | `src/screens/projects.js` |
| The exported images | `src/export/image.js` (layout), `src/export/draw.js` (shapes) |
| How Sheets columns become app data | `src/store/sheets.js` |
| What a project contains | the comment at the top of `src/model.js` |
| What happens when a button is pressed | the actions in `src/state.js` |

## Recipes
**Change a colour:** edit its token in `app.css` (e.g. `--accent: #1e3a8a;`). Save, refresh.

**Try a change on the laptop:** in `D:\sound_check` run `npm run serve`, open
http://localhost:8321, add the film file from Projects.

**After changing any app file:** bump `VERSION` in `sw.js` (e.g. `soundcheck-v2`), otherwise
installed devices keep showing the old version.

**New film:** create `D:\sound_check_data\projects\<film-id>\sources.json` (copy an old one,
change id, name and the sheet links), run `node tools/snapshot.mjs D:\sound_check_data\projects\<film-id>`,
then add the resulting file in the app (Projects → Add film).
