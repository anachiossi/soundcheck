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
from odg_reader import odg_reader_for, crew_reader_for
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


def is_sides(pdf, settings):
    """A sides PDF: "STRALCI" in its name, or the film's own word for them (settings "sides_name": Confine's sides
    are "DAY_26_Giovedì 5 novembre.pdf", Lux Vide, 5 Nov)."""
    name = Path(pdf).name.upper()
    own_word = (settings or {}).get("sides_name", "").upper()
    return "STRALCI" in name or bool(own_word and own_word in name and "ODG" not in name)


def sides_by_day(inbox, settings=None):
    """{day number: sides PDF} from every email in the inbox — production sometimes sends the
    sides in a separate email ("Re: LBE - ODG #7" with only STRALCI DAY #7.pdf).
    The day comes from the file name ("DAY #7") or else the subject ("ODG #7"); a later email wins."""
    found = {}
    for email_folder in emails_oldest_first(inbox):
        subject = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))["subject"]
        for pdf in email_folder.glob("*.pdf"):
            if not is_sides(pdf, settings):
                continue
            number = re.search(r"DAY\s*#?\s*(\d+)", pdf.name, re.I) or re.search(r"ODG\s*#?\s*(\d+)", subject, re.I)
            if number:
                found[int(number.group(1))] = pdf
    return found


def personal_call_warnings(commute, odg_crew, odg):
    """The alarms follow the call of the person Ana rides with (commute "ride_with") and her own ("my_name").
    Ana, 3 Nov: "if the personal call is different from the crew call or has some differences about unit,
    beware" — and there are two Tommasos in sound: only the FULL name matches (wake_plan.plain_name)."""
    from read_odg import as_time
    from wake_plan import plain_name, minutes_of
    warnings = []
    crew_call = minutes_of(odg.get("call") or "")
    second = odg.get("second_unit") or {}
    for key, who in (("ride_with", "rides with you"), ("my_name", "is you")):
        name = (commute.get(key) or "").strip()
        if not name:
            continue
        found = [p for p in odg_crew if plain_name(p["name"]) == plain_name(name)]
        if not found:
            warnings.append(f"{name} ({who}) is not on this ODG's crew list: the alarms count the crew call.")
            continue
        person = found[0]
        call = as_time(person["call"])
        if not call:
            warnings.append(f"{name} ({who}): call printed as \"{person['call']}\" (no time) — the alarms count the crew call.")
        elif crew_call is not None and minutes_of(call) != crew_call:
            unit = (f" It is the 2nd unit's call ({second['call']}): is {name.split()[0]} on the 2nd unit today?"
                    if second.get("call") == call else "")
            warnings.append(f"{name} ({who}): personal call {call}, the crew call is {odg['call']}. "
                            f"The alarms follow {call}.{unit}")
    return warnings


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
    own = next((p for p in Path(email_folder).glob("*.pdf") if is_sides(p, settings)), None)
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
    return sides_by_day(Path(film_folder) / "_inbox", settings), {}, []


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
    sides = read_sides(sides_pdf, day_ids, film["settings"].get("script_reader")) if sides_pdf else {}
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
            preset = film["presets"].get(sid)
            base = re.match(r"\d+", sid).group(0) if re.match(r"\d+", sid) else sid
            if not preset and base != sid and film["presets"].get(base, {}).get("rows"):
                # a scene the ODG splits (208 → 208pt1, 208pt2; Ana, 4 Nov: "it could reuse what we had") starts from
                # the whole scene's mics: same TX and lavs, only the people the ODG puts in this part
                rows = [dict(r) for r in film["presets"][base]["rows"] if not scene["cast"] or r["char_id"] in scene["cast"]]
                changes.append({"text": f"Scene {sid}: the same mics as scene {base} (TX, lavs) for "
                                        f"{len(rows)} character(s)", "scene_id": sid,
                                "op": {"op": "set_preset", "scene_id": sid, "rows": rows}})
                preset = {"scene_id": sid, "rows": rows}
            add(check_scene_mics(sid, scene["cast"], speaker_names, preset, film["characters"],
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
    odg_crew = crew_reader_for(film_folder)(odg_pdf)  # the film's own crew table reader
    ifb_today = []
    if film["crew"]:
        crew_changes, crew_checks, ifb_today = check_crew(odg_crew, film["crew"], film["ifb_rows"])
        changes.extend(crew_changes), checks.extend(crew_checks)
    warnings.extend(personal_call_warnings(film["settings"].get("commute") or {}, odg_crew, odg))

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
