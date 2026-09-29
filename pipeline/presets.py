"""presets.py — the preset generator and checker (the engine; each film's choices are in its
settings.json, see docs/DESIGN_new_film.md). No files written here: data in, rows out.

Mandatory data: each scene's rows (who is in the scene, who speaks). Optional hints, holes are fine:
a character's preferred TX, lav model, lav colour.

For every shooting day (a character keeps the SAME TX and lav all day):
  0. a row gets TX + lav only where the character speaks (YES or ?) and nothing blocks a lav;
     silent characters and people in the pool keep their row with no TX and no lav
  1. who is in the day's scenes, ranked: the protagonist first, then most lines that day
  2. TX — "small day" (every scene has at most `small_day_max_speakers` speakers who can wear a
     lav): the protagonist keeps her TX, the others take `tx_order` (3, 5, 7…) by rank.
     Otherwise ("big day"): each character's preferred TX if free, else the next free in tx_order.
     After tx_order, any other TX of the kit that isn't in `not_for_actors` (the booms).
  3. lav — the lav the character already has that day stays if it fits; a screamer (warning "loud") gets the model in `lav_rules.loud` (6061); others their
     preferred model + colour if free; else a free lav of the same model; else any free lav.
     Who doesn't get a mic in any scene that day gets no TX and no lav at all.
Used by: propose_presets.py
"""
import re

BLOCKS_LAV = ("no-lav", "water")


def natural(value):
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", str(value))]


def lines_of(film, scene_id):
    """The lines Cues shows for a scene: edited on set > sides > script > the base scene (7fin → 7)."""
    lines = film["lines"]
    edited = lines.get(f"set/{scene_id}")
    if edited and edited.get("lines"):
        return edited["lines"]
    base = re.match(r"\d+", str(scene_id))
    for key in (f"sides/{scene_id}", f"script/{scene_id}") + (
            (f"sides/{base.group()}", f"script/{base.group()}") if base and base.group() != str(scene_id) else ()):
        if lines.get(key, {}).get("lines"):
            return lines[key]["lines"]
    return []


def lav_blocked(film, scene_id, char_id):
    warnings = film["sound"].get(scene_id, {}).get("warnings", [])
    return any(str(w["char_id"]) == str(char_id) and w["kind"] in BLOCKS_LAV for w in warnings)


def gets_mic(film, scene_id, row):
    """In this scene the character wears TX + lav: they speak (YES or ?) — or they are the protagonist,
    who is always wired, even silent — and nothing blocks a lav. Otherwise the row stays (they are in
    the scene) with no TX and no lav — silent, or in the pool."""
    protagonist = str(film.get("settings", {}).get("presets", {}).get("protagonist", ""))
    wired = row.get("speaker") != "no" or str(row["char_id"]) == protagonist
    return wired and not lav_blocked(film, scene_id, row["char_id"])


def day_plan(film, settings, scene_ids):
    """{ char_id: (tx_id, lav_id) } for one shooting day, plus notes for Ana."""
    rules = settings["presets"]
    characters = {str(c["id"]): c for c in film["characters"]}
    presets = {sid: film["presets"][sid] for sid in scene_ids if sid in film["presets"]}
    notes = []

    # 1. who, ranked
    lines_count, speaks, first_seen = {}, set(), {}
    for sid in scene_ids:
        for line in lines_of(film, sid):
            lines_count[str(line.get("char_id"))] = lines_count.get(str(line.get("char_id")), 0) + 1
        for row in presets.get(sid, {}).get("rows", []):
            cid = str(row["char_id"])
            first_seen.setdefault(cid, len(first_seen))
            if row.get("speaker") == "yes":
                speaks.add(cid)
    protagonist = str(rules.get("protagonist", ""))
    people = sorted(first_seen, key=lambda c: (c != protagonist, -lines_count.get(c, 0), c not in speaks, first_seen[c]))

    # 2. TX
    kit_tx = [str(t["id"]) for t in film["transmitters"]]
    order = [t for t in rules["tx_order"] if t in kit_tx]
    order += sorted((t for t in kit_tx if t not in order and t not in rules.get("not_for_actors", [])), key=natural)
    limit = rules.get("small_day_max_speakers", 7)
    small = all(sum(1 for r in p["rows"] if r.get("speaker") == "yes" and not lav_blocked(film, sid, r["char_id"])) <= limit
                for sid, p in presets.items())
    tx, used = {}, set()

    def take(cid, wanted=None):
        choice = wanted if wanted in order and wanted not in used else next((t for t in order if t not in used), "")
        if not choice:
            notes.append(f"not enough TX for {characters.get(cid, {}).get('name', cid)}")
        used.add(choice)
        tx[cid] = choice

    # someone who can't wear a lav in any of their scenes today (all in the pool) needs no TX either
    wears = {str(r["char_id"]) for sid, p in presets.items() for r in p["rows"] if gets_mic(film, sid, r)}
    tx.update({cid: "" for cid in people if cid not in wears})
    hint = lambda cid: str(characters.get(cid, {}).get("pref_tx") or "")
    if protagonist in wears:
        take(protagonist, hint(protagonist) or order[0])
    others = [cid for cid in people if cid != protagonist and cid in wears]
    if not small:  # big day: those with a preferred TX first, so nobody without one takes it
        others = [cid for cid in others if hint(cid)] + [cid for cid in others if not hint(cid)]
    for cid in others:
        take(cid, None if small else hint(cid) or None)

    # 3. lav
    loud_model = rules.get("lav_rules", {}).get("loud")
    lavs = sorted(film["lavaliers"], key=lambda l: natural(l["id"]))
    lav, taken = {}, set()
    for cid in people:
        character = characters.get(cid, {})
        if cid not in wears:
            lav[cid] = ""
            continue
        loud = loud_model and any(str(w["char_id"]) == cid and w["kind"] == "loud"
                                  for sid in presets for w in film["sound"].get(sid, {}).get("warnings", []))
        model = loud_model if loud else character.get("pref_lav_model")
        colour = (character.get("pref_lav_color") or "").lower()
        free = [l for l in lavs if l["id"] not in taken]
        # the lav this character already has today stays, if it still fits (fewer changes on set)
        current = next((str(r.get("lav_id")) for p in presets.values() for r in p["rows"]
                        if str(r["char_id"]) == cid and r.get("lav_id")), "")
        keep = next((l for l in free if l["id"] == current and (not loud or l.get("model") == loud_model)), None)
        pick = (keep
                or next((l for l in free if l.get("model") == model and colour and l.get("color", "").lower() == colour), None)
                or next((l for l in free if model and l.get("model") == model), None)
                or next(iter(free), None))
        if loud and (not pick or pick.get("model") != loud_model):
            notes.append(f"no free {loud_model} for {character.get('name', cid)} (screams)")
        lav[cid] = pick["id"] if pick else ""
        if pick:
            taken.add(pick["id"])

    return {cid: (tx[cid], lav[cid]) for cid in people}, ("small" if small else "big"), notes


def new_rows(film, scene_id, plan):
    """The scene's rows with the day's TX and lav (same people, same order, same speaks)."""
    rows = []
    for row in film["presets"][scene_id]["rows"]:
        cid = str(row["char_id"])
        tx_id, lav_id = plan.get(cid, (row.get("tx_id", ""), row.get("lav_id", "")))
        if not gets_mic(film, scene_id, row):
            tx_id, lav_id = "", ""
        rows.append({**row, "tx_id": tx_id, "lav_id": lav_id})
    return rows


def check_scene(film, scene_id):
    """Mandatory data only: problems a person should look at (never missing hints)."""
    problems = []
    preset = film["presets"].get(scene_id)
    if not preset:
        return [f"Scene {scene_id}: no preset (who is in the scene?)"]
    names = {str(c["id"]): c["name"] for c in film["characters"]}
    rows = {str(r["char_id"]): r for r in preset["rows"]}
    lines = lines_of(film, scene_id)
    with_lines = {str(l.get("char_id")) for l in lines if l.get("char_id")}
    own_lines = any(f"{kind}/{scene_id}" in film["lines"] for kind in ("set", "sides", "script"))
    if lines and own_lines:  # 48A borrows 48's lines: not a fair comparison
        for cid in with_lines - set(rows):
            problems.append(f"Scene {scene_id}: {names.get(cid, cid)} has lines but no row")
        for cid, row in rows.items():
            if row.get("speaker") == "yes" and cid not in with_lines:
                problems.append(f"Scene {scene_id}: {names.get(cid, cid)} marked YES but has no lines")
            if row.get("speaker") == "no" and cid in with_lines:
                problems.append(f"Scene {scene_id}: {names.get(cid, cid)} marked NO but has lines")
    return problems
