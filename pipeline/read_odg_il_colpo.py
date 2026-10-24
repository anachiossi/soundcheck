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
               "SUONO": "Suono", "REGIA": "Regia", "PRODUZIONE": "Produzione", "STUNT": "Stunt", "ANIMALI": "Animali"}


def time_after(lines, label):
    """The first time printed after a label (on the next lines): 'PRONTI A GIRARE DRONE' · '09:15'."""
    for i, line in enumerate(lines):
        if line.upper().startswith(label):
            return next((as_time(x) for x in lines[i:i + 3] if TIME_RE.match(x)), "")
    return ""


def read_scene_table(lines):
    """Scenes: id, I/E, light, set, synopsis (may wrap), story day, cast ('-' = nobody), pages, [timeline]."""
    starts = [i for i in range(len(lines) - 3)
              if SCENE_ID_RE.match(lines[i]) and re.fullmatch(r"[IE](/[IE])?", lines[i + 1]) and LIGHT_RE.match(lines[i + 2])]
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
        elif re.fullmatch(r"\d+", line) and re.fullmatch(r"[A-ZÀ-Þ][A-ZÀ-Þ .'’()0-9-]*", body[i + 1]) \
                and not TIME_RE.match(body[i + 2]) and not any(c["id"] == line for c in cast):
            role = body[i + 1]
            person = {"id": line, "role": clean(re.sub(r"\s*\(M\)$", "", role)), "actor": clean(body[i + 2])}
            if role.endswith("(M)"):
                person["minor"] = True
            cast.append(person)
    return cast


def read_needs(lines, start_marker, scene_ids):
    """FABBISOGNI → {'317': {'Scenografia': 'Crocifisso, …'}}. A note with no scene numbers is for every scene of
    the day; a line that wraps ("…Cellulari," + "Giornali, Buste shopping") goes on with the scenes before it.
    "ore 08:30" is a time, never scene 08 (scene numbers are followed by ':' and a space or a word)."""
    body, _ = section(lines, start_marker, ("Direttore di Produzione", "CANALI RADIO"))
    contact = next((i for i, line in enumerate(body) if CONTACT_RE.search(line)), len(body))  # "Name (Role) 320 …"
    body = body[:contact]
    notes, department, current = {}, None, []

    def add(ids, text, joiner="; "):  # a new note after another: "; " · a wrapped line going on: " "
        for scene_id in ids:
            old = notes.setdefault(scene_id, {}).get(department, "")
            notes[scene_id][department] = clean(f"{old}{joiner if old else ''}{text.strip()}")

    for line in body:
        if line.upper() in DEPARTMENTS:
            department, current = DEPARTMENTS[line.upper()], []
            continue
        if not department:
            continue
        parts = re.split(rf"(?:^|\s+)({SCENES_RE})\s*:(?!\d)\s*", line)
        if len(parts) == 1:
            add(current or scene_ids, line, " ")  # goes on from the scenes before, or the whole day
            continue
        if parts[0].strip():
            add(current or scene_ids, parts[0], " ")
        for ids, text in zip(parts[1::2], parts[2::2]):
            current = re.findall(r"\d+[A-Za-z]*\d*", ids)
            add(current, text)
    # tidy the ends only now: a comma at the end of a line is kept while the next line goes on from it
    return {scene_id: {name: text.strip(" ,;") for name, text in by_department.items()}
            for scene_id, by_department in notes.items()}


def read_il_colpo(lines):
    text = "\n".join(lines)
    number = re.search(r"ODG\s*#\s*(\d+)(?:\s*di\s*(\d+))?", text)
    week = re.search(r"Settimana\s*#\s*(\d+)", text)
    date, weekday = read_date(text)
    advance_at = next((i for i, line in enumerate(lines) if line.startswith("Programma del giorno successivo")), len(lines))
    today, advance = lines[:advance_at], lines[advance_at:]
    scenes = read_scene_table(section(today, "TIMELINE", ("TOT PGS",))[0])
    advance_scenes = read_scene_table(section(advance, "PGS.", ("TOT PGS",))[0]) if advance else []
    advance_date, advance_weekday = read_date(advance[0]) if advance else ("", "")
    advance_times = re.findall(r"\d{1,2}[.:]\d{2}", advance[0]) if advance else []
    day = int(number.group(1)) if number else None
    return {
        "number": day, "of_days": int(number.group(2)) if number and number.group(2) else None,
        "week": int(week.group(1)) if week else None,
        "date": date, "weekday_printed": weekday,
        "call": time_after(today, "CONVOCAZIONE"), "rehearsal": time_after(today, "PROVE"),
        "ready_to_shoot": time_after(today, "PRONTI A GIRARE"),
        "end_of_shoot": time_after(today, "FINE RIPRESE"), "wrap": time_after(today, "FINE LAVORAZIONE"),
        "scenes": scenes, "cast": read_cast(today),
        "notes": read_needs(today, "FABBISOGNI", [s["scene_id"] for s in scenes]),
        "advance": advance and {
            "day": day + 1 if day else None,  # this layout doesn't print the next day's number: the next shooting day
            "date": advance_date, "weekday_printed": advance_weekday,
            "call": as_time(advance_times[0]) if advance_times else "",
            "wrap": as_time(advance_times[1]) if len(advance_times) > 1 else "",
            "scenes": advance_scenes,
            "notes": read_needs(advance, "FABBISOGNI SPECIALI", [s["scene_id"] for s in advance_scenes]),
        },
    }


def read_odg_il_colpo(path):
    """The PDF → the same data as read_odg() in read_odg.py."""
    import pymupdf as fitz
    lines = [clean(line) for page in fitz.open(path) for line in page.get_text().splitlines()]
    return read_il_colpo([line for line in lines if line])


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_odg_il_colpo(sys.argv[1]), ensure_ascii=False, indent=1))
