"""read_location.py — where to DRIVE to on a shooting day, from its ODG (Ana, 3 Nov: the alarms count the real
drive from the ride's address, by Google Maps, in the Apps Script).
The ODGs print it near the top, with a Google Maps link (32 of 33 ODGs, LBE and Il colpo):
    PARCHEGGIO TROUPE, CATERING E BAGNI: Via Furbara Sasso 94 E - https://maps.app.goo.gl/ZYJj…   ← by car: first choice
    LOCATION: Lungomare dei Navigatori Etruschi, 22 - Marina di Cerveteri - https://maps.app.goo.gl/AMuf…
    CAMPO BASE ARTISTICO: Area parcheggio tra Viale Tirreno e … - https://maps.app.goo.gl/nwxx…
The link may be on the next line. Only what the ODG prints: no address is ever guessed.

    where_to_drive(lines) → {"label": "PARCHEGGIO TROUPE", "text": "Via Furbara Sasso 94 E", "link": "https://…"} or None
Used by: run.py → file_locations (locations.json)
"""

import re

LABEL = re.compile(r"^(PARCHEGGIO TROUPE[^:]*|LOCATION|CAMPO BASE[^:]*)\s*:\s*(.*)$", re.I)
LINK = re.compile(r"https://(?:maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.\w+|www\.google\.\w+/maps)/\S+")
PREFERENCE = ("PARCHEGGIO", "LOCATION", "CAMPO")  # by car: the crew parking, else the set, else the base camp


def where_to_drive(lines):
    found = {}
    for i, line in enumerate(lines[:160]):  # the header block: never the crew list or the needs further down
        match = LABEL.match(line.strip())
        if not match:
            continue
        kind = match.group(1).upper().split()[0]
        if kind in found:
            continue
        text = match.group(2)
        link = LINK.search(text) or (LINK.search(lines[i + 1]) if i + 1 < len(lines) else None)
        found[kind] = {"label": " ".join(match.group(1).upper().split()[:2]).rstrip(","),
                       "text": LINK.sub("", text).strip(" -–"), "link": link.group(0) if link else ""}
    return next((found[kind] for kind in PREFERENCE if kind in found and (found[kind]["link"] or found[kind]["text"])), None)


def where_from_pdf(path):
    import pymupdf as fitz
    lines = [line.strip() for page in fitz.open(path) for line in page.get_text().splitlines() if line.strip()]
    return where_to_drive(lines)
