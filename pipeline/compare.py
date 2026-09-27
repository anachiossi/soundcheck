"""compare.py — compares what an ODG and its sides say with the film's current data,
and returns CHANGES (things to accept or reject in the app), WARNINGS (probably an
error in the ODG: nothing to change) and CHECKS (what was verified and is fine).
No files are read or written here: plain data in, plain data out.
Used by: propose.py
"""

import datetime
import difflib
import re

TIME_OF_DAY = {"G": "Giorno", "N": "Notte", "T": "Tramonto", "M": "Mattina", "S": "Sera", "A": "Alba"}
WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
ENGLISH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SOUND_NOTES = ["Suono", "Regia", "Costumi"]  # the department notes that matter for mics


def norm(name):
    """'Avv. Magnoni' → 'AVVOCATO MAGNONI', 'CASTELLO – CUCINA' → 'CASTELLO CUCINA'."""
    text = str(name or "").upper().replace("AVV.", "AVVOCATO ").replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^A-ZÀ-Þ0-9' ]", " ", text)).strip()


def find_character(name, characters):
    """(character id, exact?) for a name as written in an ODG or a script cue."""
    wanted = norm(name)
    for c in characters:
        if norm(c["name"]) == wanted:
            return c["id"], True
    for c in characters:  # 'LE FAVRE' ↔ 'EMANUELA LE FAVRE'
        own = norm(c["name"])
        if own and (f" {own}" in f" {wanted}" or f" {wanted}" in f" {own}"):
            return c["id"], True
    close = [(difflib.SequenceMatcher(None, norm(c["name"]), wanted).ratio(), c["id"]) for c in characters]
    best = max(close, default=(0, None))
    return (best[1], False) if best[0] >= 0.8 else (None, False)  # 'LEUDOMIA' ≈ 'LAUDOMIA'


def nice_date(iso):
    """'2026-09-28' → 'Mon 28 Sep'."""
    day = datetime.date.fromisoformat(iso)
    return f"{ENGLISH_DAYS[day.weekday()][:3]} {day.day} {day.strftime('%b')}"


def check_date(odg, subject_date):
    """The date on the sheet can be wrong: trust the weekday + the email subject."""
    warnings = []
    printed, weekday = odg["date"], odg["weekday_printed"]
    if printed and weekday:
        real = datetime.date.fromisoformat(printed).weekday()
        if WEEKDAYS[real] != weekday:
            warnings.append(f"The ODG prints '{weekday.capitalize()} {int(printed[8:])}/{printed[5:7]}', but that date is a "
                            f"{ENGLISH_DAYS[real]}: a typo on the sheet" + (f". The email says {subject_date[8:]}/{subject_date[5:7]}, "
                            "so that date is used." if subject_date else "."))
    return (subject_date or printed), warnings


def check_day(day_number, date, call, wrap, scene_ids, schedule, label):
    """Date, call/wrap and the list of scenes of one shooting day."""
    changes, checks = [], []
    rows = sorted([s for s in schedule if s["day"] == day_number], key=lambda s: s["order"])
    now = [s["scene_id"] for s in rows]
    first = rows[0] if rows else {}
    fields = {k: v for k, v in (("date", date), ("call", call), ("wrap", wrap)) if v and v != first.get(k)}
    if fields:
        before = ", ".join(f"{k} {first.get(k) or '—'} → {v}" for k, v in fields.items())
        changes.append({"text": f"{label}: {before}", "op": {"op": "set_day", "day": day_number, "fields": fields}})
    else:
        checks.append(f"{label}: date and times match")
    if scene_ids != now:
        changes.append({"text": f"{label}: scenes {' · '.join(now) or 'none'} → {' · '.join(scene_ids)}",
                        "op": {"op": "set_day_scenes", "day": day_number, "scene_ids": scene_ids}})
    else:
        checks.append(f"{label}: scenes {' · '.join(now)} match")
    return changes, checks


def check_scene_info(scene, info):
    """INT/EXT, day/night, set, synopsis, pages, story day, location of one scene."""
    info = info or {}
    wanted = {
        "int_ext": scene["int_ext"], "time_of_day": TIME_OF_DAY.get(scene["day_night"], scene["day_night"]),
        "set": scene["set"], "synopsis": scene["synopsis"], "pages": scene["pages"],
        "story_day": scene["story_day"], "location": scene["location"],
    }
    same = {
        "int_ext": lambda a, b: norm(a) == norm(b),
        "time_of_day": lambda a, b: norm(a)[:1] == norm(b)[:1],
        "set": lambda a, b: norm(a) == norm(b),
        "synopsis": lambda a, b: norm(a) == norm(b),
    }
    fields = {k: v for k, v in wanted.items()
              if v and not same.get(k, lambda a, b: str(a).strip() == str(b).strip())(v, info.get(k, ""))}
    if not fields:
        return [], [f"Scene {scene['scene_id']}: INT/EXT, set, synopsis and pages match"]
    labels = {"int_ext": "INT/EXT", "time_of_day": "time", "story_day": "story day"}
    parts = []
    for key, value in fields.items():
        before = info.get(key) or "—"
        if key == "synopsis":
            parts.append(f"synopsis → “{value}”")
        else:
            parts.append(f"{labels.get(key, key)} {before} → {value}")
    return [{"text": f"Scene {scene['scene_id']}: " + " · ".join(parts), "scene_id": scene["scene_id"],
             "op": {"op": "set_scene_info", "scene_id": scene["scene_id"], "fields": fields}}], []


def check_cast_list(odg_cast, characters):
    """Each ODG cast number must be the same character (and actor) as in the film."""
    changes, warnings, checks = [], [], []
    by_id = {c["id"]: c for c in characters}
    for row in odg_cast:
        own = by_id.get(row["id"])
        if not own:
            changes.append({"text": f"New character {row['id']} {row['role']} ({row['actor'] or 'no actor yet'})",
                            "op": {"op": "add_character", "character": {"id": row["id"], "name": row["role"],
                                                                         "actor": row["actor"], "color": "#94a3b8"}}})
            continue
        found, exact = find_character(row["role"], [own])
        if not found:
            warnings.append(f"ODG says ID {row['id']} is {row['role']}, but {row['id']} is {own['name']} here. Check who it is.")
        elif not exact:
            warnings.append(f"ODG spells '{row['role']}' for {own['name']} (ID {row['id']}): probably a typo on the sheet.")
        if row["actor"] and not own.get("actor"):
            changes.append({"text": f"{own['name']}: actor → {row['actor']}",
                            "op": {"op": "set_character", "id": row["id"], "fields": {"actor": row["actor"]}}})
        elif row["actor"] and norm(row["actor"]) != norm(own.get("actor")):
            ratio = difflib.SequenceMatcher(None, norm(row["actor"]), norm(own.get("actor"))).ratio()
            if ratio >= 0.8:
                warnings.append(f"ODG writes the actor of {own['name']} as '{row['actor']}' (here: {own['actor']}): probably a typo.")
            else:
                changes.append({"text": f"{own['name']}: actor {own['actor']} → {row['actor']}",
                                "op": {"op": "set_character", "id": row["id"], "fields": {"actor": row["actor"]}}})
    if odg_cast and not changes and not warnings:
        checks.append(f"Cast list: {len(odg_cast)} actors, all numbers and names match")
    return changes, warnings, checks
