"""read_odg_il_colpo.py — reads a call sheet in Il colpo's layout (from Oct 2026) into the SAME
data as read_odg.py (the LBE / Memo Films layout), so the robot and the proposals work unchanged.
A film uses it when its settings.json says "odg_reader": "il-colpo" (odg_reader.py picks it); read_odg.py,
the main reader, is not changed by it.

What this layout prints (ODG #48, 24 Oct 2026):
    "ODG #48 di 87  Sabato 24 Ottobre 2026  Settimana #10" · CONVOCAZIONE / PROVE / PRONTI A GIRARE /
    FINE RIPRESE / FINE LAVORAZIONE, each with its time on the next line (or after a word: "PRONTI A GIRARE DRONE")
    the scene table: SCENA · LUCE · SET/SINOSSI · DAY · CAST · PGS. · TIMELINE, one value per line:
        12 · E · G · SCUOLA · The synopsis… · 3 · - (no cast) · 1/8 · 09:15 · 09:45
    CAST: ID · RUOLO · NOME · scenes · times;  FIGURAZIONI SPECIALI: "ID.90" · "BIDELLA (Actor Name)"
    FABBISOGNI: a department, then "14: Crocifisso…  12 - 13pt1 - 14: Zaini" (scenes: text)
    page 2: "Programma del giorno successivo Lunedì 26 ottobre 2026 orario di lavorazione 10:00 - 18:00"
            + the same scene table (no timeline) + "FABBISOGNI SPECIALI del giorno successivo"

    python pipeline/read_odg_il_colpo.py "path/to/odg.pdf"
"""

import json
import re
import sys

from read_odg import as_time, clean, read_date, section

SCENE_ID_RE = re.compile(r"^\d+[A-Za-z]*\d*$")            # 315 · 517pt1 · 27A
LIGHT_RE = re.compile(r"^[GNTSMAP]$")                         # G(iorno) · N(otte) · T(ramonto) · S(era) · M(attina) · A(lba) · P(omeriggio)
CAST_RE = re.compile(r"^(-|\d+([\s,]+\d+)*)$")                # '8, 19, 62' · '-' (nobody)
PAGES_RE = re.compile(r"^(\d+\s+)?\d/8$|^\d+$")
TIME_RE = re.compile(r"^\d{1,2}[.:]\d{2}$")
CONTACT_RE = re.compile(r"\)\s*\d{3}[\s\d]{6,}$")           # the crew phone list after the needs: "(Coordinamento) 320 …"
SCENES_RE = r"\d+[A-Za-z]*\d*(?:\s*-\s*\d+[A-Za-z]*\d*)*"    # '516 - 517pt1 - 316'
# this layout's departments → the names read_odg.py uses (compare.py picks the sound-related notes by them)
DEPARTMENTS = {"SCEN/ARREDAMENTO": "Scenografia", "PROPS": "Props", "COSTUMI": "Costumi", "MAKE-UP/HAIR": "Trucco/Capelli",
               "VFX": "VFX/AI", "SFX": "SFX/Armi", "MEZZI DI SCENA": "Veicoli", "ATTREZZATURE SPECIALI": "Camera",
               "SUONO": "Suono", "REGIA": "Regia", "PRODUZIONE": "Produzione", "STUNT": "Stunt", "ANIMALI": "Animali",
               "FIGURAZIONI": "Figurazioni"}  # ODG #56


def time_after(lines, label, unit=""):
    """The first time printed after a label (on the next lines): 'PRONTI A GIRARE DRONE' · '09:15'.
    Two units (ODG #59, 9 Nov) print the label once per unit, then the times in the same order:
        CONVOCAZIONE UNITÀ DE FEUDIS · CONVOCAZIONE UNITÀ ALFIERI · 10:30 · 17:00
    → the time of the line that names `unit` (the main unit, ALFIERI: 17:00)."""
    for i, line in enumerate(lines):
        if line.upper().startswith(label):
            labels = [i]
            while labels[-1] + 1 < len(lines) and lines[labels[-1] + 1].upper().startswith(label):
                labels.append(labels[-1] + 1)
            times = [as_time(x) for x in lines[labels[-1] + 1:labels[-1] + 1 + len(labels) + 2] if TIME_RE.match(x)]
            named = [n for n, at in enumerate(labels) if unit and unit.upper() in lines[at].upper()]
            which = named[0] if named and len(labels) > 1 else 0
            if len(labels) == 1:  # one label: its time may be on the same line or the next ones
                times = [as_time(x) for x in lines[i:i + 3] if TIME_RE.match(x)]
            return times[which] if which < len(times) else (times[0] if times else "")
    return ""


INT_EXT_RE = re.compile(r"^[IE]([/+][IE])?$")                # I · E · I/E · I+E (ODG #59)


def joined_scene_id(line):
    """ODG #59 (9 Nov) prints "506 A", "241 A", "111 X": the same scenes as 506A, 241A, 111X;
    ODG #61 (11 Nov) "526C pt1", "526 Cpt2": 526Cpt1, 526Cpt2 (a part, like 208pt1)."""
    line = line.strip()
    if " " in line and re.fullmatch(r"\d+\s*[A-Z]?\s*(?:pt\s*\d+)?", line):
        return line.replace(" ", "")
    return line


def split_light_and_set(lines):
    """ODG #61 prints the light and the set on one line after I/E: "N PALAZZO TRE DITA/Parcheggio": two lines."""
    out = []
    for line in lines:
        both = re.fullmatch(r"([GNTSMAP])\s+(\S.*)", line)
        if both and out and INT_EXT_RE.match(out[-1]) and len(out) > 1 and SCENE_ID_RE.match(out[-2]):
            out.extend(both.groups())
        else:
            out.append(line)
    return out


def is_scene_start(lines, i):
    return SCENE_ID_RE.match(lines[i]) and INT_EXT_RE.match(lines[i + 1]) and LIGHT_RE.match(lines[i + 2])


def read_scene_table(lines):
    """Scenes: id, I/E, light, set, synopsis (may wrap), story day, cast ('-' = nobody), pages, [timeline]."""
    starts = [i for i in range(len(lines) - 3) if is_scene_start(lines, i)]
    scenes = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[start:end]
        # the story day, the cast and the pages come together: find them after the set and synopsis
        k = next((k for k in range(4, len(block) - 2)
                  if re.fullmatch(r"\d+[A-Za-z]?", block[k]) and CAST_RE.match(block[k + 1]) and PAGES_RE.match(block[k + 2])), None)
        if k is None:
            continue
        cast = [] if block[k + 1] == "-" else re.findall(r"\d+", block[k + 1])
        times = [as_time(x) for x in block[k + 3:k + 5] if TIME_RE.match(x)]
        scenes.append({
            "scene_id": block[0], "story_day": block[k], "int_ext": {"I": "INT", "E": "EXT"}.get(block[1], "INT/EXT"),
            "day_night": block[2], "set": clean(block[3]), "synopsis": clean(" ".join(block[4:k])),
            "cast": cast, "pages": block[k + 2], "location": "", "standby": False,
            **({"start": times[0], "end": times[1]} if len(times) == 2 else {}),
        })
    return scenes


def read_cast(lines):
    """Cast (ID · ROLE · actor) and special extras ('ID.90' · 'BIDELLA (Actor Name)'). A '(M)' after a
    role = a minor: kept as "minor": true."""
    after_table = next((i for i, line in enumerate(lines) if line.startswith("TOT PGS")), 0)  # not the table's CAST column
    body, _ = section(lines, "CAST", ("CONVOCAZIONE MINORI", "CONVOCAZIONE FIGURAZIONI TOT", "FABBISOGNI"), start_at=after_table)
    cast = []
    for i, line in enumerate(body[:-2]):
        special = re.fullmatch(r"ID\.\s*(\d+)", line)
        if special:
            match = re.fullmatch(r"(.+?)\s*\((.+)\)", body[i + 1])
            role, actor = (match.groups() if match else (body[i + 1], ""))
            cast.append({"id": special.group(1), "role": clean(role).upper(), "actor": clean(actor), "special_extra": True})
        elif re.fullmatch(r"\d+", line) and re.fullmatch(r"[A-ZÀ-Þ][A-ZÀ-Þ .'’()0-9/-]*", body[i + 1]) \
                and not TIME_RE.match(body[i + 2]) and not any(c["id"] == line for c in cast):
            role = clean(re.sub(r"\s*\(M\)$", "", body[i + 1]))
            # one actor, two roles: "11 MIRKO/MIRKETTO Samuele Peluzzi" (ODG #56) → the first is the cast number's role
            first, *others = [part.strip() for part in role.split("/")]
            person = {"id": line, "role": first, "actor": clean(body[i + 2])}
            if others:
                person["also_plays"] = others
            if body[i + 1].endswith("(M)"):
                person["minor"] = True
            cast.append(person)
    return cast


def read_needs(lines, start_marker, scene_ids, units=None):
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
        if line.upper() in DEPARTMENTS:
            department, current = DEPARTMENTS[line.upper()], []
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


# "UNIT DE FEUDIS 08:00 – 16:00" (ODG #55) · "UNIT DE FEUDIS – orario 10:30 – 18:30" (ODG #59): the name is DE FEUDIS
UNIT_RE = re.compile(r"^UNIT\s+(.+?)(?:\s*[–-]?\s*orario)?(?:\s+(\d{1,2}[.:]\d{2})\s*[–-]\s*(\d{1,2}[.:]\d{2}))?$", re.IGNORECASE)


def mark_units(table, scenes, main_unit, groups):
    """A day with two units prints "UNIT ALFIERI 14:00 – 22:00" before the main unit's scenes and
    "UNIT DE FEUDIS 08:00 – 16:00" before the 2nd unit's (ODG #55, 3 Nov). The main unit is the one the
    film's settings name ("main_unit": "ALFIERI"); every other unit is the 2nd: its scenes get
    unit '2nd' + unit_name. Returns ({name, call, wrap} of the 2nd unit or None, warnings);
    fills groups = {'ALFIERI': [scene ids], 'DE FEUDIS': [...]} for the needs (read_needs)."""
    unit_of, current, second, warnings = {}, None, None, []
    for i, line in enumerate(table):
        marker = UNIT_RE.match(line)
        if marker:
            name, call, wrap = marker.groups()
            current = (name.strip(), as_time(call) if call else "", as_time(wrap) if wrap else "")
        elif current and i + 2 < len(table) and is_scene_start(table, i):
            unit_of[line] = current
    names = list(dict.fromkeys(unit[0] for unit in unit_of.values()))
    groups.update({name.upper(): [sid for sid, unit in unit_of.items() if unit[0] == name] for name in names})
    if not names:
        return None, []
    main = (main_unit or "").upper()
    if main not in [n.upper() for n in names]:
        main = names[0].upper()  # not set, or not on this ODG: the first unit printed, said so
        warnings.append(f'Two units on the ODG ({", ".join(names)}): "{names[0]}" taken as the main unit '
                        f'(settings.json "main_unit" says "{main_unit or "nothing"}").')
    for scene in scenes:
        unit = unit_of.get(scene["scene_id"])
        if unit and unit[0].upper() != main:
            scene["unit"], scene["unit_name"] = "2nd", unit[0].title()
            second = second or {"name": unit[0].title(), "call": unit[1], "wrap": unit[2]}
    return second, warnings


def unit_spelling(line):
    """ODG #56 (4 Nov) prints "UNITÀ ALFIERI", "UNITA' …", "UNITA’ …": all read as "UNIT ALFIERI"."""
    return re.sub(r"^UNIT(?:À|A['’]?)(?=\s)", "UNIT", line)


def read_il_colpo(lines, main_unit=None):
    lines = split_light_and_set([joined_scene_id(unit_spelling(line)) for line in lines])
    text = "\n".join(lines)
    number = re.search(r"ODG\s*#\s*(\d+)(?:\s*di\s*(\d+))?", text)
    week = re.search(r"Settimana\s*#\s*(\d+)", text)
    date, weekday = read_date(text)
    advance_at = next((i for i, line in enumerate(lines) if line.startswith("Programma del giorno successivo")), len(lines))
    today, advance = lines[:advance_at], lines[advance_at:]
    # the table runs to the cast list: a two-unit day prints "TOT PGS. UNITA' ALFIERI" between the units (ODG #56),
    # so stopping at the first "TOT PGS" lost the 2nd unit's scenes
    table = [line for line in section(today, "TIMELINE", ("CAST",))[0] if not line.startswith("TOT PGS")]
    scenes = read_scene_table(table)
    groups, advance_groups = {}, {}
    second, unit_warnings = mark_units(table, scenes, main_unit, groups)
    advance_table = [line for line in section(advance, "PGS.", ("FABBISOGNI",))[0] if not line.startswith("TOT PGS")] if advance else []
    advance_scenes = read_scene_table(advance_table) if advance else []
    advance_second, advance_warnings = mark_units(advance_table, advance_scenes, main_unit, advance_groups)
    advance_date, advance_weekday = read_date(advance[0]) if advance else ("", "")
    advance_times = re.findall(r"\d{1,2}[.:]\d{2}", advance[0]) if advance else []
    day = int(number.group(1)) if number else None
    return {
        "number": day, "of_days": int(number.group(2)) if number and number.group(2) else None,
        "week": int(week.group(1)) if week else None,
        "date": date, "weekday_printed": weekday,
        # two units: the main unit's times (settings "main_unit"), even when the 2nd unit is printed first (ODG #59)
        "call": time_after(today, "CONVOCAZIONE", main_unit), "rehearsal": time_after(today, "PROVE", main_unit),
        "ready_to_shoot": time_after(today, "PRONTI A GIRARE", main_unit),
        "end_of_shoot": time_after(today, "FINE RIPRESE", main_unit), "wrap": time_after(today, "FINE LAVORAZIONE", main_unit),
        "scenes": scenes, "cast": read_cast(today),
        "second_unit": second,  # None, or {name, call, wrap}; its scenes have unit '2nd'
        "unit_warnings": unit_warnings + advance_warnings,
        "notes": read_needs(today, "FABBISOGNI", [s["scene_id"] for s in scenes], groups),
        "advance": advance and {
            "day": day + 1 if day else None,  # this layout doesn't print the next day's number: the next shooting day
            "date": advance_date, "weekday_printed": advance_weekday,
            # "orario di lavorazione 14:00 – 22:00 // 08:00 – 16:00": the main unit's hours come first
            "call": as_time(advance_times[0]) if advance_times else "",
            "wrap": as_time(advance_times[1]) if len(advance_times) > 1 else "",
            "scenes": advance_scenes, "second_unit": advance_second,
            "notes": read_needs(advance, "FABBISOGNI SPECIALI", [s["scene_id"] for s in advance_scenes], advance_groups),
        },
    }


def read_odg_il_colpo(path, main_unit=None):
    """The PDF → the same data as read_odg() in read_odg.py. main_unit: the film's settings "main_unit"."""
    import pymupdf as fitz
    lines = [clean(line) for page in fitz.open(path) for line in page.get_text().splitlines()]
    return read_il_colpo([line for line in lines if line], main_unit)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_odg_il_colpo(sys.argv[1]), ensure_ascii=False, indent=1))
