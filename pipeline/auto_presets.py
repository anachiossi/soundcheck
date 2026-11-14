"""auto_presets.py — the robot's own preset review: when new papers arrive (a call sheet, a PDL, sides), the
scenes of the coming work days that have NO preset yet get their first one, as a proposal Ana accepts or
rejects scene by scene (the same kind as propose_presets.py writes by hand).

  which days   from today to a week ahead; a film whose settings say "commute": {"days": "days_with_2nd_unit"}
               (Il colpo: Ana works only the days a 2nd unit shoots) → only those days
  which scenes the main unit's, on a day where at least one scene has no preset; the other scenes of that
               day are in the review too when their TX or lav would change (the same TX and lav all day)
  never twice  a scene already offered with exactly these rows (waiting, accepted or rejected) is not offered
               again; when its rows change (the sides arrived: now it is known who speaks) it is

A film with no "presets" rules in its settings.json gets nothing.
Used by: run.py · tests: tests/test_auto_presets.py
"""

import datetime
import json
from pathlib import Path

from first_presets import cast_by_scene
from propose_presets import days_of, load_film, proposal_of, review, write_proposal


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


def auto_review(folder, today=None, cast=None):
    """Writes the review when there is something new to offer → the proposal, else None.
    cast: { scene: [cast numbers] } given by a test; else read from the film's PDL and call sheets."""
    film = load_film(folder, with_cast=False)
    if not film["settings"].get("presets"):
        return None
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
