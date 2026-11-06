"""read_location.py — where to DRIVE to on a shooting day, and its weather, from its ODG (Ana, 3 Nov: the alarms count the real
drive from the ride's address, by Google Maps, in the Apps Script).
The ODGs print it near the top, with a Google Maps link (32 of 33 ODGs, LBE and Il colpo):
    PARCHEGGIO TROUPE, CATERING E BAGNI: Via Furbara Sasso 94 E - https://maps.app.goo.gl/ZYJj…   ← by car: first choice
    LOCATION: Lungomare dei Navigatori Etruschi, 22 - Marina di Cerveteri - https://maps.app.goo.gl/AMuf…
    CAMPO BASE ARTISTICO: Area parcheggio tra Viale Tirreno e … - https://maps.app.goo.gl/nwxx…
The link may be on the next line. Only what the ODG prints: no address is ever guessed.

    places_of(lines) → [{"kind": "parcheggio", "label": "PARCHEGGIO TROUPE", "text": "Via Furbara Sasso 94 E", "link": "https://…"}, …]
    chosen_place(places, drive_to) → the one to drive to (the film's "drive_to" first, else PREFERENCE)
Used by: run.py → file_locations (locations.json)
"""

import re

LABEL = re.compile(r"^(PARCHEGGIO TROUPE[^:]*|LOCATION|SET|MEZZI TECNICI|CAMPO BASE[^:]*)\s*:\s*(.*)$", re.I)
LINK = re.compile(r"https://(?:maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.\w+|www\.google\.\w+/maps)/\S+")
# by car: the crew parking, else the set ("LOCATION", Lux Vide "SET"), else the base camp, else the technical trucks;
# a film's commute "drive_to" goes first (Confine, 5 Nov: "mezzi", Ana rides the camera truck)
PREFERENCE = ("parcheggio", "location", "set", "campo", "mezzi")
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


def places_of(lines):
    """Every place the ODG's header prints, in its order: [{kind, label, text, link}] (Ana, 6 Nov: the alarm page shows
    them as buttons). kind: 'parcheggio' · 'mezzi' (also 'CAMPO BASE/MEZZI TECNICI') · 'location' · 'set' (Il colpo prints only the set's
    name there, Lux Vide its address too) · 'campo'."""
    found = []
    for i, line in enumerate(lines[:160]):  # the header block: never the crew list or the needs further down
        match = LABEL.match(line.strip())
        if not match:
            continue
        label = match.group(1).upper()
        kind = "mezzi" if "MEZZI" in label else label.split()[0].lower()
        if any(place["kind"] == kind for place in found):
            continue
        text = match.group(2)
        link = LINK.search(text) or (LINK.search(lines[i + 1]) if i + 1 < len(lines) else None)
        place = {"kind": kind, "label": " ".join(label.split()[:2]).rstrip(","),
                 "text": LINK.sub("", text).strip(" -–"), "link": link.group(0) if link else ""}
        if place["text"] or place["link"]:
            found.append(place)
    return found


def chosen_place(places, drive_to=""):
    """The place to drive to: the film's choice (commute "drive_to": a kind, e.g. 'mezzi') when the
    ODG prints it, else the crew parking, the set, the base camp, the trucks. None when the ODG prints none."""
    order = ([drive_to] if drive_to else []) + list(PREFERENCE)
    return next((place for kind in order for place in places if place["kind"] == kind), None)


def where_from_pdf(path, drive_to=""):
    """Where to drive + every place printed + that day's weather from the ODG:
    {kind, label, text, link, places: [...], weather, rain} or None. drive_to: the film's commute "drive_to"."""
    import pymupdf as fitz
    lines = [line.strip() for page in fitz.open(path) for line in page.get_text().splitlines() if line.strip()]
    places = places_of(lines)
    place = chosen_place(places, drive_to)
    return {**place, "places": places, **weather_of(lines)} if place else None
