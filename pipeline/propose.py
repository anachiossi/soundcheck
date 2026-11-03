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

from compare import NOTE_ICONS, note_kind, check_cast_list, check_date, check_next_day_date, check_day, check_scene_info, nice_date
from compare_mics import check_scene_mics
from compare_crew import check_crew
from read_crew import read_crew
from odg_reader import odg_reader_for
from read_sides import read_sides
from fetch_mail import emails_oldest_first


def load_film(folder):
    read = lambda name, empty=None: (json.loads((folder / name).read_text(encoding="utf-8"))
                                     if (folder / name).exists() else empty)
    presets = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (folder / "presets").glob("*.json")}
    return {"characters": read("characters.json"), "schedule": read("schedule.json"),
            "scenes": read("scenes.json"), "presets": presets,
            "settings": read("settings.json", {}),
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
    for email_folder in emails_oldest_first(inbox):
        subject = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))["subject"]
        for pdf in email_folder.glob("*.pdf"):
            if "STRALCI" not in pdf.name.upper():
                continue
            number = re.search(r"DAY\s*#?\s*(\d+)", pdf.name, re.I) or re.search(r"ODG\s*#?\s*(\d+)", subject, re.I)
            if number:
                found[int(number.group(1))] = pdf
    return found


def check_units(number, date, call, wrap, scenes, second, schedule, label):
    """The day's main unit, and its 2nd unit when the ODG prints one ("UNIT DE FEUDIS 08:00 – 16:00",
    read_odg_il_colpo.py → scenes with unit '2nd'): each checked against its own rows (Ana, 3 Nov)."""
    main_ids = [s["scene_id"] for s in scenes if not s.get("unit")]
    second_ids = [s["scene_id"] for s in scenes if s.get("unit") == "2nd"]
    results = [check_day(number, date, call, wrap, main_ids, schedule, label)]
    if second_ids:
        results.append(check_day(number, date, second["call"], second["wrap"], second_ids, schedule,
                                 f"{label} · 2nd unit", unit="2nd", unit_name=second["name"]))
    return results


def pick_sides(settings, email_folder, day, other_sides):
    """The day's sides PDF. Usually the STRALCI in the ODG's own email, else other_sides (sides_by_day).
    A film with "sides_by": "date" (Il colpo, sides_by_date.py) trusts other_sides first: there the
    STRALCI found by date and scenes, never by the number in the name."""
    own = next((p for p in Path(email_folder).glob("*.pdf") if "STRALCI" in p.name.upper()), None)
    if settings.get("sides_by") == "date":
        return (other_sides or {}).get(day)
    return own or (other_sides or {}).get(day)


def sides_for_film(film_folder):
    """({day: sides PDF}, {day: notes}, [notes for no day]) — by date for "sides_by": "date", else by number."""
    settings_file = Path(film_folder) / "settings.json"
    settings = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file.exists() else {}
    if settings.get("sides_by") == "date":
        from sides_by_date import sides_and_notes
        return sides_and_notes(film_folder)
    return sides_by_day(Path(film_folder) / "_inbox"), {}, []


def build_proposal(film_folder, email_folder, other_sides=None, sides_notes=None):
    """other_sides = sides_for_film()[0]: used when the ODG's own email has no sides (or always, by date);
    sides_notes = sides_for_film()[1]: what the day's proposal should say about its sides."""
    film_folder, email_folder = Path(film_folder), Path(email_folder)
    film = load_film(film_folder)
    email = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
    odg_pdf = next(p for p in email_folder.glob("*.pdf") if "ODG" in p.name.upper())
    odg = odg_reader_for(film_folder)(odg_pdf)  # the film's own reader (settings.json "odg_reader")
    sides_pdf = pick_sides(film["settings"], email_folder, odg["number"], other_sides)
    date, warnings = check_date(odg, subject_date(email["subject"], odg["date"][:4] or "2026"))
    warnings.extend((sides_notes or {}).get(odg["number"], []))  # e.g. "filed as day 55's sides (…)"
    day_ids = [s["scene_id"] for s in odg["scenes"]]
    sides = read_sides(sides_pdf, day_ids) if sides_pdf else {}
    changes, checks, notes = [], [], {}

    def add(result):
        c, w, k = result if len(result) == 3 else (result[0], [], result[1])
        changes.extend(c), warnings.extend(w), checks.extend(k)

    warnings.extend(odg.get("unit_warnings", []))
    for result in check_units(odg["number"], date, odg["call"], odg["wrap"], odg["scenes"], odg.get("second_unit"),
                              film["schedule"], f"Day {odg['number']}"):
        add(result)
    add(check_cast_list(odg["cast"], film["characters"]))
    advance = odg.get("advance") or {}
    days = [(odg["scenes"], odg["notes"], True)]
    if advance.get("day") and not advance["scenes"]:  # printed, but no scene read: never remove a day for that
        warnings.append(f"Day {advance['day']} (next day): its scenes could not be read on the ODG — schedule not changed.")
    elif advance.get("day"):
        advance["date"], date_warnings = check_next_day_date(advance, date)
        warnings.extend(date_warnings)
        for result in check_units(advance["day"], advance["date"], advance["call"], advance["wrap"], advance["scenes"],
                                  advance.get("second_unit"), film["schedule"], f"Day {advance['day']} (next day)"):
            add(result)
        days.append((advance["scenes"], advance.get("notes", {}), False))

    for scenes, scene_notes, today in days:
        for scene in scenes:
            sid = scene["scene_id"]
            add(check_scene_info(scene, film["scenes"].get(sid)))
            speaker_names = sides[sid]["speakers"] if today and sid in sides else None
            add(check_scene_mics(sid, scene["cast"], speaker_names, film["presets"].get(sid), film["characters"],
                                 group_cues=film["settings"].get("group_cues", [])))
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
        # the day's MAIN unit scenes on the ODG (the app's "Day N lavs" share, before review)
        "scene_ids": [s["scene_id"] for s in odg["scenes"] if not s.get("unit")],
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
