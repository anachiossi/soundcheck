"""propose.py — turns one production email (ODG + sides) into a PROPOSAL for the app.

Reads the film's current data (the JSON files in its folder), the ODG and the sides,
and writes   projects/<film>/proposals/odg-<n>.json   with:
    changes   — each one can be accepted or rejected in the app (nothing changes before that)
    warnings  — probably errors in the ODG itself (e.g. a wrong date): nothing to change
    checks    — what was verified and is fine
    ifb_today — who on the IFB list is not on the call sheet (crew changes are in `changes`)
    notes     — the ODG's sound / director / costume notes, per scene; each scene's notes
                are also offered as a change (accepted → shown on the scene bar and images)

    python pipeline/propose.py <film folder> <email folder in _inbox>
"""

import datetime
import json
import re
import sys
from pathlib import Path

from compare import NOTE_ICONS, note_kind, check_cast_list, check_date, check_day, check_scene_info, nice_date
from compare_mics import check_scene_mics
from compare_crew import check_crew
from read_crew import read_crew
from read_odg import read_odg
from read_sides import read_sides


def load_film(folder):
    read = lambda name, empty=None: (json.loads((folder / name).read_text(encoding="utf-8"))
                                     if (folder / name).exists() else empty)
    presets = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (folder / "presets").glob("*.json")}
    return {"characters": read("characters.json"), "schedule": read("schedule.json"),
            "scenes": read("scenes.json"), "presets": presets,
            "crew": read("ifb/crew.json", []), "ifb_rows": (read("ifb/list.json", {}) or {}).get("rows", [])}


def subject_date(subject, year):
    """'LBE - ODG #6 del 28.09.26' → '2026-09-28'."""
    match = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", subject or "")
    if not match:
        return ""
    day, month, yy = match.groups()
    return f"{year[:2] + yy if len(yy) == 2 else yy}-{int(month):02d}-{int(day):02d}"


NO_SIDES = "No sides (STRALCI) for this day yet: speakers were not checked."


def sides_by_day(inbox):
    """{day number: sides PDF} from every email in the inbox — production sometimes sends the
    sides in a separate email ("Re: LBE - ODG #7" with only STRALCI DAY #7.pdf).
    The day comes from the file name ("DAY #7") or else the subject ("ODG #7"); a later email wins."""
    found = {}
    for email_folder in sorted(Path(inbox).iterdir()) if Path(inbox).exists() else []:
        subject = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))["subject"]
        for pdf in email_folder.glob("*.pdf"):
            if "STRALCI" not in pdf.name.upper():
                continue
            number = re.search(r"DAY\s*#?\s*(\d+)", pdf.name, re.I) or re.search(r"ODG\s*#?\s*(\d+)", subject, re.I)
            if number:
                found[int(number.group(1))] = pdf
    return found


def build_proposal(film_folder, email_folder, other_sides=None):
    """other_sides = sides_by_day(): used when the ODG's own email has no sides."""
    film_folder, email_folder = Path(film_folder), Path(email_folder)
    film = load_film(film_folder)
    email = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
    odg_pdf = next(p for p in email_folder.glob("*.pdf") if "ODG" in p.name.upper())
    odg = read_odg(odg_pdf)
    sides_pdf = next((p for p in email_folder.glob("*.pdf") if "STRALCI" in p.name.upper()), None)
    if sides_pdf is None:
        sides_pdf = (other_sides or {}).get(odg["number"])
    date, warnings = check_date(odg, subject_date(email["subject"], odg["date"][:4] or "2026"))
    day_ids = [s["scene_id"] for s in odg["scenes"]]
    sides = read_sides(sides_pdf, day_ids) if sides_pdf else {}
    changes, checks, notes = [], [], {}

    def add(result):
        c, w, k = result if len(result) == 3 else (result[0], [], result[1])
        changes.extend(c), warnings.extend(w), checks.extend(k)

    add(check_day(odg["number"], date, odg["call"], odg["wrap"], day_ids, film["schedule"], f"Day {odg['number']}"))
    add(check_cast_list(odg["cast"], film["characters"]))
    advance = odg.get("advance") or {}
    days = [(odg["scenes"], odg["notes"], True)]
    if advance.get("day"):
        add(check_day(advance["day"], advance["date"], advance["call"], advance["wrap"],
                      [s["scene_id"] for s in advance["scenes"]], film["schedule"], f"Day {advance['day']} (next day)"))
        days.append((advance["scenes"], advance.get("notes", {}), False))

    for scenes, scene_notes, today in days:
        for scene in scenes:
            sid = scene["scene_id"]
            add(check_scene_info(scene, film["scenes"].get(sid)))
            speaker_names = sides[sid]["speakers"] if today and sid in sides else None
            add(check_scene_mics(sid, scene["cast"], speaker_names, film["presets"].get(sid), film["characters"]))
            for department, text in scene_notes.get(sid, {}).items():
                kind, text = note_kind(department, text)  # 'sound' (visible), 'info' (more info) or None
                seen = [t.lower() for _, t in notes.get(sid, [])]
                if kind and not any(text.lower()[:40] in t for t in seen):  # the same fact from two departments: once
                    notes.setdefault(sid, []).append((kind, f"{NOTE_ICONS.get(department, '⚠')} {text}"
                                                            + ("" if department == "Suono" else f" (ODG, {department.lower()})")))
            if scene.get("standby"):  # listed under "STAND BY:" in the ODG: shot only if there is time
                day_number = odg["number"] if today else advance.get("day")
                notes.setdefault(sid, []).append(("sound", f"⏸ stand-by on day {day_number}"))
    for sid, found in notes.items():
        known = film["scenes"].get(sid) or {}
        for kind, note in found:
            if note in known.get("notes", "") or note in known.get("info", []):
                continue
            where = "more info" if kind == "info" else "notes"
            changes.append({"text": f"Scene {sid} {where}: {note}", "scene_id": sid,
                            "op": {"op": "add_note", "scene_id": sid, "note": note, "kind": kind}})
    if sides_pdf is None:
        warnings.append(NO_SIDES)

    # IFB: the crew printed on the call sheet against the IFB crew list
    ifb_today = []
    if film["crew"]:
        crew_changes, crew_checks, ifb_today = check_crew(read_crew(odg_pdf), film["crew"], film["ifb_rows"])
        changes.extend(crew_changes), checks.extend(crew_checks)

    for number, change in enumerate(changes, 1):
        change["id"] = f"c{number}"
    return {
        "id": f"odg-{odg['number']}",
        "title": f"ODG #{odg['number']} · Day {odg['number']} · {nice_date(date)}",
        "day": odg["number"], "date": date, "call": odg["call"],
        "source": {"subject": email["subject"], "received": email["date"], "files": email["files"]},
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "status": "open" if changes else "done",  # done when every change is accepted or rejected
        "decisions": {},    # { change id: 'accepted' | 'rejected' }, filled in the app
        "changes": changes, "warnings": warnings, "checks": checks, "notes": notes,
        "ifb_today": ifb_today,  # who on the IFB list is not on today's call sheet
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.path.insert(0, str(Path(__file__).parent))
    proposal = build_proposal(sys.argv[1], sys.argv[2])
    print(json.dumps(proposal, ensure_ascii=False, indent=1))
