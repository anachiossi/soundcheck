"""day_mics.py — every call sheet (ODG) proposes the missing TX and lavs of its days (Ana, 18 Nov: "for any day that
arrives it reads the ODG and sets the TX presets for each scene based on the sides, if not the script").

For the main unit's scenes of one day, after the sheet's other changes (who was added, who speaks):
  who speaks    the day's sides; a scene with no sides takes the script. The script can number its scenes another
                way than the production, so it only ever says who DOES speak, and not when it names someone the
                sheet's cast doesn't list for that scene
  which mic     the film's rules (Film → Lav Rules), the same TX and lav all day (presets.day_plan)
  never         a TX or lav already chosen is not changed: only the empty ones are filled

Each scene gets one change "set_mics", accepted or rejected in the proposal like the others.
Used by: propose.py · tests: tests/test_day_mics.py
"""

import copy

from odg_presets import lines_from_speakers
from presets import day_plan, gets_mic
from propose_presets import describe_new, load_film


def rows_after(presets, changes):
    """The presets as they will be once the sheet's earlier changes are accepted."""
    after = copy.deepcopy(presets)
    for change in changes:
        op = change["op"]
        rows = after.get(op.get("scene_id"), {}).get("rows")
        if op["op"] == "set_preset":
            after[op["scene_id"]] = {"scene_id": op["scene_id"], "rows": copy.deepcopy(op["rows"])}
        elif op["op"] == "add_row":
            after.setdefault(op["scene_id"], {"scene_id": op["scene_id"], "rows": []})["rows"].append(dict(op["row"]))
        elif op["op"] == "remove_row" and rows is not None:
            rows[:] = [row for row in rows if row["char_id"] != op["char_id"]]
        elif op["op"] == "set_speaker" and rows is not None:
            for row in rows:
                if row["char_id"] == op["char_id"]:
                    row["speaker"] = op["speaker"]
        elif op["op"] == "number_character":
            for preset in after.values():
                for row in preset["rows"]:
                    if row["char_id"] == op["from"]:
                        row["char_id"] = op["character"]["id"]
    return after


def script_speakers(film, scene):
    """Who speaks in the script's scene of this number; nobody when the scene has sides, or when the script names
    a numbered character the sheet doesn't list here (then it is another scene with the same number)."""
    scene_id = scene["scene_id"]
    if f"sides/{scene_id}" in film["lines"]:
        return []
    lines = (film["lines"].get(f"script/{scene_id}") or {}).get("lines") or []
    speaking = list(dict.fromkeys(str(line.get("char_id") or "") for line in lines if line.get("char_id")))
    cast = {str(number) for number in scene.get("cast") or []}
    return [] if any(char_id.isdigit() and char_id not in cast for char_id in speaking) else speaking


def missing_mics(film, scene_id, plan):
    """The rows of this scene with no TX that should have one → [{char_id, tx_id, lav_id}]."""
    rows = film["presets"][scene_id]["rows"]
    used_tx = {row.get("tx_id") for row in rows if row.get("tx_id")}
    used_lav = {row.get("lav_id") for row in rows if row.get("lav_id")}
    mics = []
    for row in rows:
        tx_id, lav_id = plan.get(str(row["char_id"]), ("", ""))
        if row.get("tx_id") or not tx_id or tx_id in used_tx or not gets_mic(film, scene_id, row):
            continue
        mics.append({"char_id": row["char_id"], "tx_id": tx_id, "lav_id": "" if lav_id in used_lav else lav_id})
    return mics


def mic_changes_of_day(film, scenes, changes, sides=None):
    """film: propose_presets.load_film's · scenes: one day's, as the sheet prints them · changes: the sheet's so far ·
    sides: read_sides' { scene: {"speakers": [...]} } for that day. → (the new changes, lines for Ana)"""
    film = {**film, "presets": rows_after(film["presets"], changes), "lines": dict(film["lines"])}
    names = {str(character["id"]): character["name"] for character in film["characters"]}
    main = [scene for scene in scenes if not scene.get("unit") and scene["scene_id"] in film["presets"]]
    found = []
    for scene in main:
        scene_id = scene["scene_id"]
        if sides and scene_id in sides:
            film["lines"][f"sides/{scene_id}"] = lines_from_speakers(film, sides[scene_id]["speakers"])
        speaking = script_speakers(film, scene)
        for row in film["presets"][scene_id]["rows"]:
            if row.get("speaker") == "maybe" and str(row["char_id"]) in speaking:
                row["speaker"] = "yes"
                found.append({"text": f"Scene {scene_id}: {names.get(str(row['char_id']), row['char_id'])} speaks MAYBE → YES (script)",
                              "scene_id": scene_id,
                              "op": {"op": "set_speaker", "scene_id": scene_id, "char_id": row["char_id"], "speaker": "yes"}})
    scene_ids = [scene["scene_id"] for scene in main]
    plan, _, notes = day_plan(film, film["settings"], scene_ids, keep_tx=True)
    for scene_id in scene_ids:
        mics = missing_mics(film, scene_id, plan)
        if mics:
            shown = [{**mic, "speaker": next(r["speaker"] for r in film["presets"][scene_id]["rows"] if r["char_id"] == mic["char_id"])} for mic in mics]
            found.append({"text": f"Scene {scene_id} mics: " + "; ".join(describe_new(film, shown)), "scene_id": scene_id,
                          "op": {"op": "set_mics", "scene_id": scene_id, "mics": mics}})
    return found, notes


def odg_day_mics(film_folder, scenes, changes, sides=None, characters=None):
    """The same, reading the film from its folder. A film with no mic rules gets nothing; a failure never stops the ODG."""
    try:
        film = load_film(film_folder, with_cast=False)
        film["characters"] = characters or film["characters"]
        if not film["settings"].get("presets"):
            return [], []
        return mic_changes_of_day(film, scenes, changes, sides)
    except Exception as error:
        return [], [f"⚠ The TX for this day could not be worked out ({error}): set them by hand."]
