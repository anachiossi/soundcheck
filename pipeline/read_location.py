"""read_location.py — where to DRIVE to on a shooting day, and its weather, from its ODG (Ana, 3 Nov: the alarms count the real
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

LABEL = re.compile(r"^(PARCHEGGIO TROUPE[^:]*|LOCATION|SET|MEZZI TECNICI|CAMPO BASE[^:]*)\s*:\s*(.*)$", re.I)
LINK = re.compile(r"https://(?:maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.\w+|www\.google\.\w+/maps)/\S+")
# by car: the crew parking, else the set ("LOCATION", Lux Vide "SET"), else the base camp, else the technical trucks
PREFERENCE = ("PARCHEGGIO", "LOCATION", "SET", "CAMPO", "MEZZI")
# a film's commute "drive_to": "mezzi" (Confine, 5 Nov: Ana rides the camera truck, so it goes to the MEZZI TECNICI,
# Lux Vide also "CAMPO BASE/MEZZI TECNICI"; else the set)
PREFERENCE_MEZZI = ("MEZZI", "SET", "LOCATION", "PARCHEGGIO", "CAMPO")
# The ODG's weather ("METEO: Pomeriggio: irregolarmente nuvoloso…", LBE "Meteo: Rovesci intensi dalle 7:00…"):
# rain or a storm anywhere in it → a rain day: the Apps Script adds the film's commute "rain_penalty" to the drive
# (Ana, 3 Nov: "if there is rain or storm that day I'll give it a rain penalty").
WEATHER = re.compile(r"^METEO\s*:\s*(.*)$", re.I)
RAIN = re.compile(r"\b(piogg\w*|pioviggin\w*|rovesc\w*|temporal\w*|acquazzon\w*|grandin\w*|nubifragi\w*|"
                  r"precipitazion\w*|nev(e|icat\w*)|allert\w*)\b", re.I)


def weather_of(lines):
    """{"weather": the ODG's forecast as printed, "rain": True/False} or {} when the ODG has none."""
    for line in lines[:160]:
        match = WEATHER.match(line.strip())
        if match and match.group(1).strip():
            text = match.group(1).strip()
            return {"weather": text, "rain": bool(RAIN.search(text))}
    return {}


def where_to_drive(lines, preference=PREFERENCE):
    found = {}
    for i, line in enumerate(lines[:160]):  # the header block: never the crew list or the needs further down
        match = LABEL.match(line.strip())
        if not match:
            continue
        kind = "MEZZI" if "MEZZI" in match.group(1).upper() else match.group(1).upper().split()[0]
        if kind in found:
            continue
        text = match.group(2)
        link = LINK.search(text) or (LINK.search(lines[i + 1]) if i + 1 < len(lines) else None)
        found[kind] = {"label": " ".join(match.group(1).upper().split()[:2]).rstrip(","),
                       "text": LINK.sub("", text).strip(" -–"), "link": link.group(0) if link else ""}
    return next((found[kind] for kind in preference if kind in found and (found[kind]["link"] or found[kind]["text"])), None)


def where_from_pdf(path, drive_to=""):
    """Where to drive + that day's weather from the ODG: {label, text, link, weather, rain} or None.
    drive_to: the film's commute "drive_to" ("mezzi" → the technical trucks first)."""
    import pymupdf as fitz
    lines = [line.strip() for page in fitz.open(path) for line in page.get_text().splitlines() if line.strip()]
    place = where_to_drive(lines, PREFERENCE_MEZZI if drive_to == "mezzi" else PREFERENCE)
    return {**place, **weather_of(lines)} if place else None
