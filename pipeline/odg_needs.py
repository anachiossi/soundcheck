"""odg_needs.py — the departments' needs printed on a call sheet (FABBISOGNI): which scene needs what from whom.
    FABBISOGNI → a department on its own line ("PROPS"), then "14: Crocifisso…  12 - 13pt1 - 14: Zaini" (scenes: text)
    → { '14': { 'Props': 'Crocifisso…; Zaini' }, … }
compare.py picks the notes that matter for sound out of them (a stunt, a vehicle, haze, playback…).
Moved out of read_odg_il_colpo.py (14 Nov) so the template reader (read_odg_table.py) reads the same notes;
a film can add its own department words (odg_template.py → "departments").
Used by: read_odg_il_colpo.py, read_odg_table.py · tests: tests/test_read_odg_il_colpo.py
"""

import re

from read_odg import clean, section

CONTACT_RE = re.compile(r"\)\s*\d{3}[\s\d]{6,}$")           # the crew phone list after the needs: "(Coordinamento) 320 …"
SCENES_RE = r"\d+[A-Za-z]*\d*(?:\s*-\s*\d+[A-Za-z]*\d*)*"    # '516 - 517pt1 - 316'
# this layout's departments → the names read_odg.py uses (compare.py picks the sound-related notes by them)
DEPARTMENTS = {"SCEN/ARREDAMENTO": "Scenografia", "PROPS": "Props", "COSTUMI": "Costumi", "MAKE-UP/HAIR": "Trucco/Capelli",
               "VFX": "VFX/AI", "SFX": "SFX/Armi", "MEZZI DI SCENA": "Veicoli", "ATTREZZATURE SPECIALI": "Camera",
               "SUONO": "Suono", "REGIA": "Regia", "PRODUZIONE": "Produzione", "STUNT": "Stunt", "ANIMALI": "Animali",
               "FIGURAZIONI": "Figurazioni"}  # ODG #56


def unit_spelling(line):
    """ODG #56 (4 Nov) prints "UNITÀ ALFIERI", "UNITA' …", "UNITA’ …": all read as "UNIT ALFIERI"."""
    return re.sub(r"^UNIT(?:À|A['’]?)(?=\s)", "UNIT", line)


def read_needs(lines, start_marker, scene_ids, units=None, departments=None):
    """FABBISOGNI → {'317': {'Scenografia': 'Crocifisso, …'}}. A note with no scene numbers is for every scene of
    the day; a line that wraps ("…Cellulari," + "Giornali, Buste shopping") goes on with the scenes before it.
    "ore 08:30" is a time, never scene 08 (scene numbers are followed by ':' and a space or a word).
    units = {'ALFIERI': [ids], 'DE FEUDIS': [ids]} (mark_units): "UNIT DE FEUDIS AUTO RAGAZZI…" is only for
    that unit's scenes; a plain line repeated inside the next UNIT line ("STUNT COORDINATOR" +
    "UNIT ALFIERI STUNT COORDINATOR") is printed twice: kept once, for that unit (ODG #55, 3 Nov)."""
    body, _ = section(lines, start_marker, ("Direttore di Produzione", "CANALI RADIO"))
    contact = next((i for i, line in enumerate(body) if CONTACT_RE.search(line)), len(body))  # "Name (Role) 320 …"
    # the crew table can follow straight after the needs (ODG #56): its header "REGIA · SET · FOTOGRAFIA · SET"
    # ends them (REGIA alone is also a needs department)
    crew = next((i for i in range(len(body) - 1) if body[i] == "REGIA" and body[i + 1] == "SET"), len(body))
    body = body[:min(contact, crew)]
    units = units or {}
    departments = departments or DEPARTMENTS
    # ODG #56: "208 – 241 - 426:" (long dashes) and "330 A – 331:" (a space in 330A) → "208 - 241 - 426:", "330A - 331:"
    body = [re.sub(r"\b(\d{2,4}) ([A-Z])\b(?=\s*[-–,:])", r"\1\2", line.replace("–", "-")) for line in body]

    def unit_line(line):  # ('DE FEUDIS', 'AUTO RAGAZZI…') or None — also with a typo ("UNITA DE FEUIDIS", ODG #56)
        import difflib
        upper = line.upper()
        if not upper.startswith("UNIT"):
            return None
        rest = re.sub(r"^UNIT(?:À|A['’]?)?\s+", "", line)
        for name in sorted(units, key=len, reverse=True):
            words = len(name.split())  # compare as many words as the name has ("DE FEUIDIS" = "DE FEUDIS")
            head = " ".join(rest.split()[:words]).upper()
            if head == name or difflib.SequenceMatcher(None, head, name).ratio() >= 0.85:
                return name, " ".join(rest.split()[words:])
        return None

    def parts_of(ids):  # "208" on the needs = every part the day shoots: 208pt1, 208pt2
        out = []
        for sid in ids:
            own = [s for s in scene_ids if s == sid or (re.match(rf"{re.escape(sid)}(?!\d)", s) and sid not in scene_ids)]
            out += own or [sid]
        return list(dict.fromkeys(out))

    scoped = []
    for i, line in enumerate(body):
        unit = unit_line(line)
        if unit:
            scoped.append((units[unit[0]], unit[1]))
        elif i + 1 < len(body) and unit_line(body[i + 1]) and unit_line(body[i + 1])[1].strip() == line.strip():
            continue  # the same text printed again in the next UNIT line
        else:
            scoped.append((None, line))
    notes, department, current = {}, None, []

    def add(ids, text, joiner="; "):  # a new note after another: "; " · a wrapped line going on: " "
        for scene_id in ids:
            old = notes.setdefault(scene_id, {}).get(department, "")
            notes[scene_id][department] = clean(f"{old}{joiner if old else ''}{text.strip()}")

    for only, line in scoped:
        if line.upper() in departments:
            department, current = departments[line.upper()], []
            continue
        if not department:
            continue
        parts = re.split(rf"(?:^|\s+)({SCENES_RE})\s*:(?!\d)\s*", line)
        if len(parts) == 1:
            add(only or current or scene_ids, line, " ")  # one unit, or goes on from the scenes before, or the whole day
            if only:
                current = only
            continue
        if parts[0].strip():
            add(only or current or scene_ids, parts[0], " ")
        for ids, text in zip(parts[1::2], parts[2::2]):
            current = parts_of(re.findall(r"\d+[A-Za-z]*\d*", ids))
            add(current, text)
    # tidy the ends only now: a comma at the end of a line is kept while the next line goes on from it
    return {scene_id: {name: text.strip(" ,;") for name, text in by_department.items()}
            for scene_id, by_department in notes.items()}
