"""first_presets.py — the FIRST mic rows of a scene that has no preset yet: who is in it and who speaks.

  who is in the scene  = the cast numbers the production prints for it (the newest call sheet that lists the
                         scene, else the shooting schedule, PDL)
  who speaks           = the scene's lines: the sides of that day when they are filed, else the script
                         (presets.lines_of: edited on set > sides > script)

  speaker "yes"   the character has lines in the scene
  speaker "no"    the scene has lines, none are theirs
  speaker "maybe" no lines are filed for the scene: nobody knows yet

A character with lines who is not in the printed cast gets a row too (and a line for Ana), unless it is a
voice off set (radio, TV, a crowd). TX and lav are NOT chosen here: presets.day_plan does that for the whole day.
Used by: propose_presets.py · tests: tests/test_first_presets.py
"""

import json
from pathlib import Path

from presets import lines_of


def first_rows(film, scene_id, cast_ids):
    """→ (rows with no TX and no lav yet, lines for Ana about this scene)."""
    characters = {str(c["id"]): c for c in film["characters"]}
    name = lambda char_id: characters.get(char_id, {}).get("name", f"ID {char_id}")
    cast = [str(number) for number in cast_ids]
    notes = [f"Scene {scene_id}: cast number {c} is not a character of the film yet" for c in cast if c not in characters]
    lines = lines_of(film, scene_id) or []
    speaking = []
    for line in lines:
        char_id = str(line.get("char_id") or "")
        if char_id and char_id not in speaking:
            speaking.append(char_id)
    from_sides = bool(film["lines"].get(f"sides/{scene_id}", {}).get("lines") or film["lines"].get(f"set/{scene_id}", {}).get("lines"))
    own_lines = from_sides or bool(film["lines"].get(f"script/{scene_id}", {}).get("lines"))
    # the script can number its scenes another way than the production (Il colpo ep. 6: the script's 631 is in
    # the garden with BALLERINO, the schedule's 631 is in the study with MINO and TERRY). A character with a
    # cast number who speaks in the script's scene but is not in the printed cast: those lines are not trusted.
    strangers = [c for c in speaking if c.isdigit() and c not in cast]
    if lines and not from_sides and strangers and cast:
        notes.append(f"Scene {scene_id}: in the script {', '.join(name(c) for c in strangers)} speaks here, but the printed "
                     "cast does not list them: the script's scene may be another one. Who speaks is not known")
        lines, speaking = [], []
    elif not lines:
        notes.append(f"Scene {scene_id}: no lines filed (no sides, not found in the script): who speaks is not known")
    elif not own_lines:  # 631A reads the lines of the whole scene 631: who has lines there MAY speak in this part
        notes.append(f"Scene {scene_id}: no lines of its own, only those of the whole scene: who speaks is a guess")
    extra = [c for c in speaking if c not in cast and not characters.get(c, {}).get("off_set")] if own_lines else []
    rows = []
    for char_id in cast + extra:
        speaker = "yes" if char_id in speaking else ("no" if lines and own_lines else "maybe")
        rows.append({"char_id": char_id, "tx_id": "", "lav_id": "", "speaker": speaker})
    if extra and cast:
        notes.append(f"Scene {scene_id}: {', '.join(name(c) for c in extra)} has lines but is not in the printed cast")
    return rows, notes


def cast_from_pdl(folder):
    """{ scene: [cast numbers] } from the film's latest shooting schedule (docs/pdl.pdf). No PDL: {}."""
    from pdl_reader import pdl_reader_for
    pdl = Path(folder) / "docs" / "pdl.pdf"
    if not pdl.exists():
        return {}
    reading = pdl_reader_for(folder)(pdl)
    return {scene["scene_id"]: scene.get("cast") or [] for day in reading["days"] for scene in day["scenes"]}


def cast_from_call_sheets(folder):
    """{ scene: [cast numbers] } from every filed call sheet (docs/day-N/odg.pdf), oldest first so the newest
    sheet wins; a sheet's next-day scenes count too. A sheet that can't be read is skipped."""
    from odg_reader import odg_reader_for
    from reading_checks import checked_reading
    folder = Path(folder)
    settings = json.loads((folder / "settings.json").read_text(encoding="utf-8"))
    reader = odg_reader_for(folder)
    cast = {}
    day_folders = sorted((folder / "docs").glob("day-*"), key=lambda p: int(p.name.split("-")[1]) if p.name.split("-")[1].isdigit() else 0)
    for day_folder in day_folders:
        pdf = day_folder / "odg.pdf"
        if not pdf.exists():
            continue
        try:
            odg = reader(pdf)
            if not odg.get("scenes"):  # nothing read: ask the second reader (slow, so only then)
                odg, _ = checked_reading(odg, pdf, settings)
        except Exception:
            continue
        for scene in (odg.get("scenes") or []) + ((odg.get("advance") or {}).get("scenes") or []):
            if scene.get("cast"):
                cast[scene["scene_id"]] = scene["cast"]
    return cast


def cast_by_scene(folder):
    """The printed cast of every scene the production's papers list: the PDL, then the call sheets on top."""
    return {**cast_from_pdl(folder), **cast_from_call_sheets(folder)}
