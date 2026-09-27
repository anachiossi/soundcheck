"""propose_pdl.py — turns a new shooting schedule (PDL + scaletta) into a PROPOSAL:
a whole review of the film from today on.
    • cast list: numbers and names
    • every shooting day from today: date, week, call/wrap, which scenes in which order;
      new days, and days that disappeared
    • every scene from today (and scenes with no day yet): INT/EXT, time, set, synopsis, pages…
    • every preset from today: the PDL cast of the scene against its mics (who, how many)
Days already shot are not touched. Days covered by an ODG proposal keep the ODG's
date, times and scenes: the ODG of the day is more precise than the PDL.
Speakers are not checked here (the PDL has no dialogue): the sides do that, day by day.

    python pipeline/propose_pdl.py <film folder> <email folder in _inbox>
"""

import datetime
import json
import sys
from pathlib import Path

from compare import check_cast_list, check_day, check_scene_info, nice_date
from compare_mics import check_scene_mics
from propose import load_film, subject_date
from read_pdl import read_pdl


def odg_days(film_folder):
    """Days (and the 'next day' printed on them) that an ODG already covers."""
    covered = set()
    for path in (film_folder / "proposals").glob("odg-*.json"):
        proposal = json.loads(path.read_text(encoding="utf-8"))
        covered |= {proposal["day"], proposal["day"] + 1}
    return covered


def as_odg_scene(scene):
    """The PDL's scene in the same shape the ODG checks use."""
    return {"scene_id": scene["scene_id"], "story_day": scene["story_day"],
            "int_ext": scene["int_ext"].replace("EXT/INT", "INT/EXT"),
            "day_night": scene["time_of_day"][:1].upper(), "set": scene["set"],
            "synopsis": scene["synopsis"], "pages": scene["pages"], "location": scene["location"],
            "cast": scene["cast"]}


def build_pdl_proposal(film_folder, email_folder, today=None):
    film_folder, email_folder = Path(film_folder), Path(email_folder)
    today = today or datetime.date.today().isoformat()
    film = load_film(film_folder)
    email = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
    pdl_pdf = next(p for p in email_folder.glob("*.pdf") if "PDL" in p.name.upper())
    scaletta_pdf = next((p for p in email_folder.glob("*.pdf") if "SCALETTA" in p.name.upper()), None)
    pdl = read_pdl(pdl_pdf, scaletta_pdf)
    changes, warnings, checks = [], [], []

    def add(result):
        c, w, k = result if len(result) == 3 else (result[0], [], result[1])
        changes.extend(c), warnings.extend(w), checks.extend(k)

    add(check_cast_list([{"id": i, "role": name, "actor": ""} for i, name in pdl["cast"].items()], film["characters"]))

    covered = odg_days(film_folder)
    future = [d for d in pdl["days"] if d["date"] >= today]
    future_scenes = [s for d in future for s in d["scenes"]]
    for day in future:
        if day["day"] in covered:
            checks.append(f"Day {day['day']}: left as the ODG says")
            continue
        add(check_day(day["day"], day["date"], day["call"], day["wrap"],
                      [s["scene_id"] for s in day["scenes"]], film["schedule"], f"Day {day['day']}", day["week"]))
    pdl_days = {d["day"] for d in pdl["days"]}
    for number in sorted({s["day"] for s in film["schedule"] if s["date"] >= today} - pdl_days - covered):
        changes.append({"text": f"Day {number} is no longer in the PDL: take its scenes off the schedule",
                        "op": {"op": "set_day_scenes", "day": number, "scene_ids": []}})

    scheduled = {s["scene_id"] for d in pdl["days"] for s in d["scenes"]}
    unscheduled = [s for sid, s in pdl["scenes"].items() if sid not in scheduled]
    for scene in future_scenes + unscheduled:
        add(check_scene_info(as_odg_scene(scene), film["scenes"].get(scene["scene_id"])))
    for scene in future_scenes:
        add(check_scene_mics(scene["scene_id"], scene["cast"], None, film["presets"].get(scene["scene_id"]),
                             film["characters"], source="PDL"))
    if unscheduled:
        checks.append(f"{len(unscheduled)} scene(s) without a shooting day: {', '.join(s['scene_id'] for s in unscheduled)}")

    for number, change in enumerate(changes, 1):
        change["id"] = f"c{number}"
    issued = subject_date(email["subject"] + ".2026", "2026") or email["date"]
    first, last = (future[0]["day"], future[-1]["day"]) if future else (0, 0)
    return {
        "id": f"pdl-{issued}", "kind": "pdl",
        "title": f"PDL of {nice_date(issued)} · days {first}–{last}",
        "day": first, "date": today,
        "source": {"subject": email["subject"], "received": email["date"], "files": email["files"]},
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "status": "open" if changes else "done",
        "decisions": {}, "changes": changes, "warnings": warnings, "checks": checks, "notes": {},
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(build_pdl_proposal(sys.argv[1], sys.argv[2]), ensure_ascii=False, indent=1))
