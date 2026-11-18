"""sound_analysis.py — the first sound analysis (AT) of a film's scenes, from its scripts and PDL (Ana, 18 Nov: "if an
analise técnica is missing do one for each script"). A film asks for it with settings.json "sound_analysis": true.

For each scene with no sound/<scene>.json yet, one file like LBE's:
  flags     what makes it hard, found by words in the script's action lines and the PDL's synopsis (WORDS below)
  warnings  "loud" for the one character a sentence says is screaming: the robot then gives them the screamers' lav
  notes     the sentence each flag was found in, so Ana can check it
  level     never written: the level stays the app's suggestion (src/sound-rules.js) until Ana chooses one

A script can number its scenes another way than the production (Il colpo's 631): when the script's scene has a numbered
character the production doesn't print for it, only the PDL's synopsis is read. A file already there is never changed.
Used by: run.py · tests: tests/test_sound_analysis.py
"""

import datetime
import json
import re
from pathlib import Path

from first_presets import cast_by_scene
from read_lines import SCENE_ID_RE, SCENE_X, page_lines

WORDS = {
    "water": r"piscina|mare|fiume|lago|doccia|vasca|bagnat[oaie]|sott'acqua|nuot\w+|pioggia|piove\w*|tuff[ao]\w*",
    "scream": r"urla\w*|urlo|grida\w*|grido|strill\w*|rissa",
    "eating": r"mangia\w*|mastica\w*|addenta\w*|pranz\w+|cenano",
    "fx": r"spar[aoi]|sparano|sparando|sparatoria|pistolettat\w+|esplo\w+|detona\w+|mitragli\w+|trapan\w+|tagliasiepi",
    "music": r"canta|cantano|cantando|concerto|orchestra|suonano",   # live music only: it makes a scene HARD
    "car": r"auto|automobile|macchina|furgone|moto|camion|berlina",
    "crowd": r"folla|invitati|pubblico|tifosi|ressa|calca",
    "kids": r"bambin[oaie]|ragazzin[oaie]|neonat[oaie]",
    "animal": r"cane|cani|molosso|cavall[oi]|gatto|pappagall[oi]|parrocchett[oi]",
}
FOUND = {flag: re.compile(rf"\b(?:{words})\b", re.I) for flag, words in WORDS.items()}
ACTION_X = (95, 125)  # the action lines of the script's page (the dialogue and the names are further right)


def script_actions(script_pdf):
    """{ scene: its action lines as one text } of one script PDF."""
    scenes, current = {}, None
    for _, _, x, text in page_lines(script_pdf):
        if SCENE_X[0] <= x <= SCENE_X[1] and SCENE_ID_RE.match(text):
            current = text
            scenes.setdefault(current, [])
        elif current and ACTION_X[0] <= x <= ACTION_X[1]:
            scenes[current].append(text)
    return {scene: " ".join(lines) for scene, lines in scenes.items()}


def sentences(text):
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\s*--\s*", text or "") if part.strip()]


def analyse(text, characters):
    """The action text of one scene → { flags, notes, warnings }."""
    flags, notes, warnings = [], [], []
    for sentence in sentences(text):
        for flag, words in FOUND.items():
            if words.search(sentence) and flag not in flags:
                flags.append(flag)
                notes.append(f"{flag}: {sentence}")
        if FOUND["scream"].search(sentence):
            named = [c for c in characters if re.search(rf"\b{re.escape(c['name'])}\b", sentence, re.I)]
            if len(named) == 1 and not any(w["char_id"] == named[0]["id"] for w in warnings):
                warnings.append({"char_id": named[0]["id"], "kind": "loud", "text": sentence[:80]})
    return {"flags": [flag for flag in FOUND if flag in flags], "notes": "\n".join(notes), "warnings": warnings}


def script_can_be_read(folder, scene_id, printed_cast):
    """False when the script's scene of this number has a numbered character the production doesn't print for it."""
    path = Path(folder) / "lines" / "script" / f"{scene_id}.json"
    if not printed_cast or not path.exists():
        return True
    lines = json.loads(path.read_text(encoding="utf-8")).get("lines") or []
    return not any(str(line.get("char_id") or "").isdigit() and str(line["char_id"]) not in map(str, printed_cast) for line in lines)


def missing_analysis(folder, cast=None, actions=None):
    """Writes the scenes' missing sound files → their scene numbers. cast, actions: given by a test."""
    folder = Path(folder)
    read = lambda name: json.loads((folder / name).read_text(encoding="utf-8"))
    if not read("settings.json").get("sound_analysis"):
        return []
    cast = cast if cast is not None else cast_by_scene(folder)
    if actions is None:
        actions = {}
        for script in sorted((folder / "docs" / "scripts").glob("*.pdf")):
            actions.update(script_actions(script))
    synopsis = {scene_id: info.get("synopsis", "") for scene_id, info in read("scenes.json").items()}
    characters = [c for c in read("characters.json") if not c.get("off_set")]
    scene_ids = set(actions) | set(synopsis) | {str(row["scene_id"]) for row in read("schedule.json") if row.get("scene_id")}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    written = []
    (folder / "sound").mkdir(exist_ok=True)
    for scene_id in sorted(scene_ids):
        path = folder / "sound" / f"{scene_id}.json"
        if path.exists():
            continue
        trusted = script_can_be_read(folder, scene_id, cast.get(scene_id))
        text = " ".join(part for part in (actions.get(scene_id, "") if trusted else "", synopsis.get(scene_id, "")) if part)
        found = analyse(text, characters)
        reason = "From the script and the PDL" if trusted and scene_id in actions else "From the PDL (the script numbers this scene another way)" if scene_id in actions else "From the PDL"
        path.write_text(json.dumps({"scene_id": scene_id, "reason": reason, **found, "updated_at": now, "updated_by": "the AT"},
                                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(scene_id)
    return written
