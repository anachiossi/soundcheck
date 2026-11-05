"""day_documents.py — the OTHER documents of a day's ODG email (Ana, 5 Nov, Confine day 27: "All docs should be
downloaded and remain in the database for that day. Including the location map … Ignore the transport list").

The ODG and the sides already go to docs/day-<n>/odg.pdf and sides.pdf (run.py → file_documents). Everything else
in the same email goes next to them, under its own name:

    'Mappa Day#27.pdf'                  → docs/day-27/map.pdf  (the app's 🗺 Map button)
    'IC PROTOCOLLO SET CHIUSO.pdf'      → docs/day-27/IC PROTOCOLLO SET CHIUSO.pdf
    'Lista trasporti 6 novembre.pdf'    → never kept (fetch_mail.py doesn't even save it)

An email with no ODG inside ("R: CONFINE | ODG#27", the intimacy coordinator's papers) finds its day in the subject.

    is_transport(name) · is_map(name) · day_in_subject(subject) → 27 or None
    extra_documents(email_folder, skip) → [(source file, name in docs/day-<n>/)]
Used by: run.py (file_documents), fetch_mail.py (is_transport, KEPT)
"""

import re
from pathlib import Path

KEPT = (".pdf", ".jpg", ".jpeg", ".png")  # the files the robot saves from an email (a map can be a photo)


def is_transport(name):
    """'Lista trasporti Venerdì 6 novembre.pdf', 'TRANSPORT LIST.pdf' → True."""
    return bool(re.search(r"traspor|transport", name, re.I))


def is_map(name):
    """'Mappa Day#27.pdf', 'MAPPE.pdf', 'IC - Map_56.jpg' → True ('Mapping' or 'Rimappatura' → False)."""
    return bool(re.search(r"(?<![a-z])(mapp[ae]|maps?)(?![a-z])", name, re.I))


def day_in_subject(subject):
    """'Fwd: CONFINE | ODG#27 - Venerdì 6 novembre' → 27; a subject with two ODG numbers, or none → None."""
    numbers = set(re.findall(r"ODG\s*#?\s*(\d+)", subject or "", re.I))
    return int(numbers.pop()) if len(numbers) == 1 else None


def extra_documents(email_folder, skip):
    """The email's files that are not the ODG or sides already filed (skip: those files), nor a transport list,
    each with its name in docs/day-<n>/: the map is 'map' + its own extension (a second map 'map-2'), the rest
    keep their name."""
    found, maps = [], 0
    for source in sorted(Path(email_folder).iterdir()):
        if source.suffix.lower() not in KEPT or source in skip or is_transport(source.name):
            continue
        if re.search(r"stralci|sides|odg", source.name, re.I):  # another day's or another unit's: not this day's
            continue
        name = source.name
        if is_map(source.name):
            maps += 1
            name = ("map" if maps == 1 else f"map-{maps}") + source.suffix.lower()
        found.append((source, name))
    return found
