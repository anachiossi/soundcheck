"""auto_presets.py — the robot's own preset review: when new papers arrive (a call sheet, a PDL, sides), the
scenes of the coming work days that have NO preset yet get their first one, as a proposal Ana accepts or
rejects scene by scene (the same kind as propose_presets.py writes by hand).

  which days   from today to a week ahead; a film whose settings say "commute": {"days": "days_with_2nd_unit"}
               (Il colpo: Ana works only the days a 2nd unit shoots) → only those days
  which scenes the main unit's, on a day where at least one scene has no preset; the other scenes of that
               day are in the review too when their TX or lav would change (the same TX and lav all day)
  never twice  a scene already offered with exactly these rows (waiting, accepted or rejected) is not offered
               again; when its rows change (the sides arrived: now it is known who speaks) it is

A film with "wire_silent": "cast" (Il colpo, Ana 18 Nov: "from the PDL and the scripts it should already create presets
for every scene") gets every_scene_review instead: every scene of every day still to shoot, not only the coming week.

A film with no "presets" rules in its settings.json gets nothing.
Used by: run.py · tests: tests/test_auto_presets.py
"""

import datetime
import json
from pathlib import Path

from day_mics import mic_changes_of_day, rows_after
from first_presets import cast_by_scene
from presets import by_tx, day_plan, gets_mic
from propose_presets import days_of, describe_new, load_film, proposal_of, review, write_proposal


def coming_days(film, today, days_ahead=7):
    """The day numbers to look at: dated from today to days_ahead later; only 2nd-unit days when the film says so."""
    last = (datetime.date.fromisoformat(today) + datetime.timedelta(days=days_ahead)).isoformat()
    only_with_2nd = (film["settings"].get("commute") or {}).get("days") == "days_with_2nd_unit"
    with_2nd = {item["day"] for item in film["schedule"] if item.get("unit")}
    return [day for day, info in days_of(film).items()
            if today <= (info["date"] or "") <= last and (day in with_2nd or not only_with_2nd)]


def offered_before(folder):
    """{ scene: [the rows of every earlier preset review that offered it] }"""
    offered = {}
    for path in (Path(folder) / "proposals").glob("presets-*.json"):
        for change in json.loads(path.read_text(encoding="utf-8"))["changes"]:
            offered.setdefault(change["scene_id"], []).append(change["op"]["rows"])
    return offered


def one_mic_each(film, presets, scene_ids):
    """One day: someone with two TX or lavs, or a TX or lav on two people, takes the day's own → the scenes changed."""
    worn = [(str(row["char_id"]), kind, row[kind]) for scene_id in scene_ids for row in presets[scene_id]["rows"]
            for kind in ("tx_id", "lav_id") if row.get(kind)]
    clashing = {who for who, kind, mic in worn
                if len({m for w, k, m in worn if w == who and k == kind}) > 1 or len({w for w, k, m in worn if k == kind and m == mic}) > 1}
    plan, _, _ = day_plan({**film, "presets": presets}, film["settings"], scene_ids, keep_tx=True)
    changed = []
    for scene_id in scene_ids:
        for row in presets[scene_id]["rows"]:
            tx_id, lav_id = plan.get(str(row["char_id"]), ("", ""))
            if str(row["char_id"]) in clashing and tx_id and (row.get("tx_id"), row.get("lav_id")) != (tx_id, lav_id):
                row.update(tx_id=tx_id, lav_id=lav_id)
                changed.append(scene_id)
            elif str(row["char_id"]) in clashing and row.get("tx_id") and not gets_mic(film, scene_id, row):
                row.update(tx_id="", lav_id="")  # an extra holding an actor's mic
                changed.append(scene_id)
    return changed


def every_scene_review(folder, film, today, cast=None):
    """Every scene from today on: the printed actors, who speaks and the empty TX and lavs (day_mics.py), one change per
    scene. The production's cast decides who is in a scene, also when the script numbers it another way."""
    cast = cast if cast is not None else cast_by_scene(folder)
    days = {day: info for day, info in days_of(film).items() if (info["date"] or "") >= today}
    changes, warnings, day_of = [], [], {}
    for day, info in days.items():
        scenes = [{"scene_id": scene_id, "cast": cast.get(scene_id, [])} for scene_id in info["scenes"]]
        found, notes = mic_changes_of_day(film, scenes, changes)
        changes += found
        warnings += [f"Day {day}: {note}" for note in notes]
        day_of.update({change["scene_id"]: day for change in found})
    after = rows_after(film["presets"], changes)
    for day, info in days.items():
        fixed = one_mic_each(film, after, [scene_id for scene_id in info["scenes"] if scene_id in after])
        day_of.update({scene_id: day for scene_id in fixed})
    offered = offered_before(folder)
    review_changes = []
    for scene_id, day in day_of.items():
        rows = by_tx(after[scene_id]["rows"])
        if rows not in offered.get(scene_id, []):
            review_changes.append({"id": f"c{len(review_changes) + 1}", "scene_id": scene_id,
                                   "text": f"Day {day} · scene {scene_id}: " + "; ".join(describe_new(film, rows)),
                                   "op": {"op": "set_preset", "scene_id": scene_id, "rows": rows}})
    if not review_changes:
        return None
    proposal = proposal_of(folder, review_changes, warnings, f"days {min(days)}–{max(days)}", min(days))
    write_proposal(folder, proposal)
    return proposal


def auto_review(folder, today=None, cast=None):
    """Writes the review when there is something new to offer → the proposal, else None.
    cast: { scene: [cast numbers] } given by a test; else read from the film's PDL and call sheets."""
    film = load_film(folder, with_cast=False)
    if not film["settings"].get("presets"):
        return None
    if film["settings"]["presets"].get("wire_silent") == "cast":
        return every_scene_review(folder, film, today or datetime.date.today().isoformat(), cast)
    days = coming_days(film, today or datetime.date.today().isoformat())
    missing = [scene for day in days for scene in days_of(film)[day]["scenes"] if scene not in film["presets"]]
    if not missing:
        return None
    film["cast"] = cast if cast is not None else cast_by_scene(folder)
    changes, warnings = review(film, min(days), days, only_days_with_new=True)
    offered = offered_before(folder)
    changes = [change for change in changes if change["op"]["rows"] not in offered.get(change["scene_id"], [])]
    if not changes:
        return None
    for number, change in enumerate(changes, 1):
        change["id"] = f"c{number}"
    proposal = proposal_of(folder, changes, warnings, f"days {', '.join(map(str, days))}", min(days))
    write_proposal(folder, proposal)
    return proposal
