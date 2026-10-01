# Design — from production PDFs to a ready film (new-film pipeline)

Status: **agreed direction, nothing built yet** · written 2026-09-29 with Ana · may change.
Private diary of the discussion: `D:\script_read_claude\docs\2026-09-29_soundcheck_log.md`.

## Why
The first film (LBE) arrived already built: breakdown, characters and presets came from the old
Sheets and the Colab preset generator, then were moved to JSON. Since then nothing *creates* presets;
they only change by hand or by accepted proposals, so the generator's first mistakes stay. For the
next films soundcheck should **build** the film from the production documents, ask Ana what is
unclear, and only then generate presets.

## The idea that makes it possible: engine = code, choices = data
- **Engine (code, shared by every film):** knows *how* — read a PDF table, rank speakers, assign TX in
  an order, keep a character's lav preferences, avoid a lav on someone in the water.
- **Project settings (data, `settings.json` in the film's folder):** say *which* behaviours to use and
  with what values. A film's particularities live here, never in the code, and never carry over.
- The code changes only when a film needs a behaviour the engine has never had; that behaviour is
  added as a new option (then available to every later film), and the film's settings pick it.
- Honest limit: with one film we can't know what varies. **The second film shows what really needs to
  be a setting.** Design the settings now, move LBE's quirks into them, let the next film shape the readers.

### What is mandatory, what is a hint (Ana, 2026-09-29)
- **Mandatory:** the presets — every scene's rows: character · TX · lav · speaks.
- **Optional hints, holes are fine:** a character's preferred TX, lav model, lav colour. Nobody is
  asked to fill them. The checker never flags a missing preference.
- The generator uses a hint when there is one; otherwise the next free TX in the film's TX order and
  any free lav of a suitable model. Two characters with the same preferred TX is only a problem when
  both are in the same scene → the second gets the next free TX.

### Preset settings (example = LBE's real rule)
```json
"presets": {
  "tx_order": ["3", "5", "7", "9", "11", "13", "15"],
  "protagonist": "1",
  "strategies": [
    { "when": "speakers_with_lav <= 7", "assign_tx": "tx_order", "rank_by": "most_lines_in_scene",
      "except": "the protagonist keeps her TX" },
    { "when": "otherwise", "assign_tx": "preferred_tx" }
  ],
  "keep_lav_preferences": true,
  "lav_rules": { "scream": "6061 or attenuated", "water": "no lav", "nude": "no lav" }
}
```
Confirmed by Ana (2026-09-29), as built in `pipeline/presets.py`:
- A character keeps the **same TX and lav all day**, so the rule is decided **per day**: if every scene
  that day has ≤7 speakers who can wear a lav → odd TX order (3, 5, 7…) by who speaks most; if any
  scene has more → the whole day uses preferred TX.
- "Speaks most" = lines **added up over the day's scenes**. The protagonist is always TX 3.
- Counts toward the 7: characters who **speak and can wear a lav** (not everyone in the scene; 7
  speakers all in the pool count as 0). Silent characters still get a TX, after the speakers.
- Small day with more than 7 people: after 15 the free even TX (4, 6, 8…), never TX 1–2 or booms.
- Big day: no preferred TX → next free in the order; same preferred TX for two → more lines wins.
- A row gets TX + lav only where the character speaks (YES or ?) and nothing blocks a lav. Silent
  characters and people in the pool keep their row (they are in the scene) with no TX and no lav.
- The protagonist is ALWAYS wired when in the scene, even silent ("batman privileges"), unless a
  warning blocks the lav (pool).
- Screamers get a 6061.

Earlier definitions:
- "speaks most" = most **lines**; the protagonist (TX 3 in LBE) is the exception.
- "speakers with a lav" = characters who speak **and have no warning that prevents a lav** (7 speakers
  all in the pool → no lavs possible).
- Why odd TX numbers: Ana's choice — for the engine it is just the order in the settings.
- The film has no TX 1 and 2: simply a `tx_order` starting at 3.
- Lav model and colour hints are kept whatever the TX strategy.
- Open: may a character's TX change between scenes of the same day? Screamers: lav model 6061, or any
  lav marked attenuated?

### Reader profiles (the scrapers' "adaptation" as data)
First real case (Vigília, Oct 2026): `settings.json` → `"script_reader": { "watermarks": true,
"unnumbered_scenes": true }`, read by `pipeline/cue_lines.py` and passed to `read_lines.py`; off by
default, so LBE reads exactly as before.
Per film: language (`it`), document words ("STRALCI" = sides, "SCALETTA", "PERSONALE AGGIUNTO" =
daily hires), ODG layout (where cast and crew are), date formats, email search / subject tag.
Today these are hard-coded for LBE in `pipeline/` and in one-off `work/` scripts → they become the
LBE profile. Same kind of paperwork → a new profile file; truly new paperwork → a new reader in the
engine, reusable afterwards.

## The new-film flow (stages + readiness check)
```
1 Project     name → folder in soundcheck-data + settings file from a template
2 Kit         lavs, TX, IFB receivers, headphones — in the app, or imported from a Sheet/CSV template
3 Sources     script · PDL/schedule · scaletta (optional) · crew list with phones (optional)
              · cast list (optional) — missing crew/cast data comes later from the ODGs
4 Analysis    read + think → scenes, cast, speakers, the sound AT (dificultômetro, flags, warnings)
              → QUESTIONS for Ana (collective names, script vs PDL conflicts, unclear readings)
5 Ready?      checklist: ✓ kit ✓ schedule ✓ speakers ✓ AT … or "missing: cast list"
6 Presets     generator (engine + film settings + AT) → a proposal Ana reviews
7 Production  ODG / sides / PDL emails → proposals (exists today)
```

### Getting the sources in (Ana: both)
- **Email (Ana's favourite):** send to the robot's mailbox with a tag in the subject (e.g. `[SC LBE]`),
  like the ODGs today; the robot files the attachments in the film's `sources/`.
- **Upload button in the app** (for other users, and for files that arrive by WhatsApp). An iPhone
  home-screen app cannot appear in the share sheet (Apple doesn't allow it for web apps), so:
  WhatsApp → Save to Files → upload, or WhatsApp → forward by email.

### The "thinking" part (stage 4)
Parsing = plain code (tables, dates, headings). Thinking = judgement a parser can't make: who is
really on set (a photo of a character isn't the character), who a collective cue means, whether a
scene is hard and why, what is dangerous for a lav. That needs AI.
- Agreed: a **guided Claude Code session** ("new film"), once per film, using Ana's subscription —
  the way the LBE AT was made, but with a fixed recipe and fixed outputs.
- The session reads the sources scene by scene, writes a **draft** of the film (scenes, cast,
  speakers, sound AT) into the JSON marked `draft`, plus **questions** instead of guesses. Ana answers
  them in the app (like proposals); each answer is saved in the film (`decisions.json`) so nothing
  asks twice. The draft can also be exported to a Sheet/xlsx for reviewing on the laptop.
- Once approved, the draft becomes the film's data (the AT written directly); presets always come
  as a proposal.

## Order of work
0. Save this doc; measure the iPhone weight; publish the docs to Drive.
1. **LBE `settings.json`**: TX order from 3, protagonist, the ≤7 rule, lav rules. No visible change.
2. **Preset review for the remaining days** (proposal): a checker (mandatory rows only) + the
   generator (settings + lines per scene + AT warnings + optional hints); never touches shot days or
   scenes Ana edited, unless asked; compared with the presets really used on days 1–7.
3. **Kit import/export** with a Sheet/CSV template (October).
4. **New-film intake** — design details in October; built and rehearsed in November on Nobody's
   Diary or Campioni as a mock film before the next real one.
Parked: Simon game for Cues; plain level chip in the sound bar?; quieter lav-picker warning?

## Is the format still right? (iPhone weight)
- Measured: the app ≈ 2.1 MB (code 0.3 MB + PDF viewer 1.7 MB + fonts 0.1 MB), downloaded once.
  LBE's JSON after 7 days ≈ 0.66 MB (presets 142 KB, lines 265 KB, sound 113 KB, proposals 64 KB, rest).
- Documents are the heavy part: ODG + sides ≈ 0.5 MB per shooting day, script ≈ 0.75 MB → ~20–25 MB
  per film. The film's JSON is a few hundred KB. The app is small and cached once (the PDF viewer is
  its biggest piece).
- A home-screen web app on iPhone gets its own, generous storage; the app asks iOS to keep it.
- Verdict: JSON + one database per film + PDFs on the device is still the right shape. Later:
  "remove this film from the device" when a film wraps (it stays in the repo), and optionally
  "PDFs: this week only".
