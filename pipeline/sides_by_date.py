"""sides_by_date.py — finds which shooting day a STRALCI (sides) PDF belongs to by its DATE and its SCENES,
never by the number in its name. For films whose settings say "sides_by": "date" (Il colpo).

Why (Ana, 3 Nov, Il colpo's first files): the numbers are not reliable, the dates are —
    "IC - Stralci_54_02.11.26.pdf"   stamp inside "day#53_Lun_02.11"  → day 54 (the stamp's number is wrong)
    "IC - Stralci_53_03.10.26.pdf"   stamp inside "day#55_Mar_03.11"  → day 55 (03.10 in the name is a typo)
The day is the ODG whose date is the stamp's date (else the name's date) AND whose scenes are in the sides.
No such ODG → the ODG sharing the most scenes, said in a note; none at all → not filed, said in a note.
Several sides for one day: the newest email wins; in the same email, the one whose name has that day.

    sides_and_notes(film_folder) → ({day: sides PDF}, {day: [notes for that day's proposal]}, [notes for no day])
Used by: run.py, propose.py
"""

import json
import re
from pathlib import Path

from fetch_mail import emails_oldest_first
from odg_reader import odg_reader_for
from read_sides import read_sides

STAMP_RE = re.compile(r"day\s*#\s*(\d+)_\w+_(\d{1,2})\.(\d{1,2})", re.I)   # "day#55_Mar_03.11"
NAME_DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})")                # "_03.11.26"


def odg_days(inbox, read_odg):
    """{day: {"date": '2026-11-03', "scenes": {'604', …}}} from every ODG in the inbox (a newer email wins)."""
    days = {}
    for email_folder in emails_oldest_first(inbox):
        for pdf in email_folder.glob("*.pdf"):
            if "ODG" in pdf.name.upper():
                odg = read_odg(pdf)
                scenes = {s["scene_id"] for s in odg["scenes"]}
                days[odg["number"]] = {"date": odg["date"], "scenes": scenes}
    return days


def stamp_of(pdf):
    """(number, 'MM-DD') printed inside the sides, or (None, None)."""
    import pymupdf as fitz
    text = "\n".join(page.get_text() for page in fitz.open(pdf))
    match = STAMP_RE.search(text)
    return (int(match.group(1)), f"{int(match.group(3)):02d}-{int(match.group(2)):02d}") if match else (None, None)


def name_date(pdf):
    match = NAME_DATE_RE.search(pdf.name)
    return f"{int(match.group(2)):02d}-{int(match.group(1)):02d}" if match else None


def day_of(pdf, days):
    """(day or None, note or None) for one sides PDF."""
    scenes = set(read_sides(pdf))
    stamp_number, stamp_date = stamp_of(pdf)
    named = re.search(r"STRALCI\D{0,3}(\d+)", pdf.name, re.I)
    for when, what in ((stamp_date, "the date printed inside"), (name_date(pdf), "the date in its name")):
        if not when:
            continue
        for day, odg in days.items():
            if odg["date"].endswith(when) and scenes & odg["scenes"]:
                printed = {int(named.group(1)) if named else None, stamp_number} - {None, day}
                note = (f"{pdf.name}: filed as day {day}'s sides ({what}, {odg['date']}, and its scenes); "
                        f"the number {', '.join(map(str, sorted(printed)))} printed on it is not that day."
                        if printed else None)
                return day, note
    best = sorted(((len(scenes & odg["scenes"]), day) for day, odg in days.items()), reverse=True)
    if best and best[0][0] and (len(best) == 1 or best[1][0] < best[0][0]):
        day = best[0][1]
        return day, f"{pdf.name}: its date matches no ODG; filed as day {day}'s sides by its scenes."
    return None, f"{pdf.name}: not filed — no ODG has its date and its scenes ({', '.join(sorted(scenes)) or 'none read'})."


def sides_and_notes(film_folder):
    film_folder = Path(film_folder)
    inbox = film_folder / "_inbox"
    days = odg_days(inbox, odg_reader_for(film_folder))
    found, notes, loose = {}, {}, []
    for email_folder in emails_oldest_first(inbox):
        info = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
        email_id = (info.get("message_id") or email_folder.name).split("#")[0]  # packets of one email: one id
        for pdf in sorted(email_folder.glob("*.pdf")):
            if "STRALCI" not in pdf.name.upper():
                continue
            day, note = day_of(pdf, days)
            if day is None:
                loose.append(note)
                continue
            named_here = re.search(rf"STRALCI\D{{0,3}}{day}(?!\d)", pdf.name, re.I)
            if day in found and found[day][1] == email_id and found[day][2] and not named_here:
                # same email, and the sides already found carry this day's own number: they stay
                loose.append(f"{pdf.name}: also day {day}'s sides; {found[day][0].name} is used.")
                continue
            if day in found and found[day][1] == email_id:
                loose.append(f"{found[day][0].name}: also day {day}'s sides; {pdf.name} is used.")
            found[day] = (pdf, email_id, bool(named_here))
            if note:
                notes.setdefault(day, []).append(note)
    for day in list(notes):  # a note about sides that lost to better ones is not about the filed sides
        notes[day] = [n for n in notes[day] if n.startswith(found[day][0].name)] if day in found else []
    return {day: pdf for day, (pdf, _, _) in found.items()}, notes, loose


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    sides, notes, loose = sides_and_notes(sys.argv[1])
    print(json.dumps({"sides": {d: p.name for d, p in sides.items()}, "notes": notes, "not filed": loose},
                     ensure_ascii=False, indent=1))
