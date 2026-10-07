"""compare_mics.py — checks one scene's preset (who has a mic, who speaks) against:
  • the ODG cast of that scene: who is in it, and how many
  • the sides: who actually speaks (needs the sides of that day)
Rules (Ana, 28 Sep 2026):
  - everyone who speaks must have a row, marked YES
  - someone marked YES who doesn't speak in the sides → NO
  - someone in the ODG cast without a row → add a row (TX: their preferred TX if free)
  - someone with a row who isn't in the ODG cast and doesn't speak → maybe remove (Ana decides)
Used by: propose.py
"""

from compare import find_character


def preferred_free_tx(character, rows):
    used = {row["tx_id"] for row in rows}
    tx = (character or {}).get("pref_tx", "")
    return tx if tx and tx not in used else ""


def check_scene_mics(scene_id, odg_cast_ids, speaker_names, preset, characters, source="ODG", group_cues=()):
    """speaker_names: None when there are no sides for this scene.
    group_cues: cues that are a group talking (settings.json, e.g. TUTTI, I DOMESTICI) — not a character."""
    changes, warnings, checks = [], [], []
    by_id = {c["id"]: c for c in characters}
    rows = (preset or {}).get("rows", [])
    in_preset = {row["char_id"] for row in rows}
    name = lambda cid: by_id.get(cid, {}).get("name", f"ID {cid}")

    speakers = set()
    groups = {g.upper() for g in group_cues}
    heard_groups = [cue for cue in speaker_names or [] if cue.upper() in groups]
    if heard_groups:
        checks.append(f"Scene {scene_id}: group cues {', '.join(heard_groups)} (a group talking, not a character)")
    for cue in speaker_names or []:
        if cue.upper() in groups:
            continue
        cid, _ = find_character(cue, characters)
        if cid:
            speakers.add(cid)
        else:
            warnings.append(f"Scene {scene_id}: '{cue}' speaks in the sides but isn't a character in the film.")

    # 1. who should be in the scene: the ODG cast, plus anyone who speaks
    for cid in list(dict.fromkeys(list(odg_cast_ids) + sorted(speakers))):
        if cid in in_preset:
            continue
        speaks = "yes" if cid in speakers else ("no" if speaker_names is not None else "maybe")
        reason = "speaks in the sides" if cid in speakers else f"in the {source} cast"
        row = {"char_id": cid, "tx_id": preferred_free_tx(by_id.get(cid), rows), "lav_id": "", "speaker": speaks}
        changes.append({"text": f"Scene {scene_id}: add {name(cid)} ({reason})", "scene_id": scene_id,
                        "op": {"op": "add_row", "scene_id": scene_id, "row": row}})

    # 2. rows for people who are not in the scene
    for cid in in_preset:
        if odg_cast_ids and cid not in odg_cast_ids and cid not in speakers:
            changes.append({"text": f"Scene {scene_id}: {name(cid)} has a mic but isn't in the {source} cast. Remove?",
                            "scene_id": scene_id, "op": {"op": "remove_row", "scene_id": scene_id, "char_id": cid}})

    # 3. YES / NO from the sides
    if speaker_names is not None:
        for row in rows:
            should = "yes" if row["char_id"] in speakers else "no"
            if row["speaker"] != should and (row["char_id"] in speakers or row["char_id"] in odg_cast_ids or not odg_cast_ids):
                changes.append({"text": f"Scene {scene_id}: {name(row['char_id'])} speaks {row['speaker'].upper()} → {should.upper()}",
                                "scene_id": scene_id, "op": {"op": "set_speaker", "scene_id": scene_id,
                                                             "char_id": row["char_id"], "speaker": should}})

    if not changes:
        plural = lambda n, word: f"{n} {word}{'' if n == 1 else 's'}"
        who = (f"{plural(len(odg_cast_ids), 'actor')} in the {source} = {plural(len(rows), 'mic')}"
               if odg_cast_ids else plural(len(rows), "mic"))
        spoke = ", speakers match the sides" if speaker_names is not None else ""
        checks.append(f"Scene {scene_id}: {who}{spoke}")
    return changes, warnings, checks
