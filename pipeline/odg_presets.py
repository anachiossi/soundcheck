"""odg_presets.py — the first presets of a call sheet's scenes, for its proposal (propose.py).

A scene of the main unit that has no preset (and is not a part of a scene that has one: 208pt1 starts from 208)
gets ONE change "first preset": everyone in the sheet's cast for that scene, who speaks (the day's sides when
they came with the sheet, else the lines already filed: sides, script), and the day's TX and lav from the
film's preset rules — instead of one "add …, speaks maybe" change per person with no TX
(Il colpo's PDL, 3 Nov: 217 such changes, rejected whole).

A film with no "presets" rules or no kit to read gets nothing here: propose.py then adds the people one by one.
Used by: propose.py · tests: tests/test_auto_presets.py
"""

import re

from compare import find_character
from first_presets import first_rows
from presets import day_plan, new_rows
from propose_presets import describe_new, load_film


def needs_first_preset(film, scene):
    scene_id = scene["scene_id"]
    base = re.match(r"\d+", scene_id)
    part_of_known = base and base.group(0) != scene_id and film["presets"].get(base.group(0), {}).get("rows")
    return not scene.get("unit") and scene.get("cast") and scene_id not in film["presets"] and not part_of_known


def lines_from_speakers(film, speaker_names):
    """The sides' speaker names as lines with a character each (only who speaks matters here)."""
    lines = []
    for name in speaker_names:
        char_id, _ = find_character(name, film["characters"])
        if char_id:
            lines.append({"name": name, "char_id": char_id, "text": ""})
    return {"lines": lines}


def first_presets_of_day(film, scenes, sides=None):
    """film: propose_presets.load_film's · scenes: one day's, as the call sheet prints them · sides: read_sides'
    { scene: {"speakers": [...]} } for that day, or nothing.
    → ({ scene: {"rows": [...], "text": "…"} }, lines for Ana)"""
    new, notes = [], []
    for scene in scenes:
        scene_id = scene["scene_id"]
        if not needs_first_preset(film, scene):
            continue
        if sides and scene_id in sides:
            film["lines"][f"sides/{scene_id}"] = lines_from_speakers(film, sides[scene_id]["speakers"])
        rows, scene_notes = first_rows(film, scene_id, scene["cast"])
        film["presets"][scene_id] = {"scene_id": scene_id, "rows": rows}
        new.append(scene_id)
        notes += scene_notes
    if not new:
        return {}, []
    main_ids = [s["scene_id"] for s in scenes if not s.get("unit") and s["scene_id"] in film["presets"]]
    plan, kind, plan_notes = day_plan(film, film["settings"], main_ids)
    found = {}
    for scene_id in new:
        rows = new_rows(film, scene_id, plan)
        found[scene_id] = {"rows": rows, "text": f"Scene {scene_id}: first preset ({kind} day): " + "; ".join(describe_new(film, rows))}
    return found, notes + plan_notes


def odg_first_presets(film_folder, scenes, sides=None):
    """The same, reading the film from its folder. Anything missing (no rules, no kit): nothing, never an error."""
    try:
        film = load_film(film_folder, with_cast=False)
        if not film["settings"].get("presets"):
            return {}, []
        return first_presets_of_day(film, scenes, sides)
    except Exception:
        return {}, []
