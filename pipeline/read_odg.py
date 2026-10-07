"""read_odg.py — reads a call sheet (ODG, "ordine del giorno") PDF into plain data.

Made on the LBE call sheets (Memo Films layout); other productions may need tweaks.
What it finds:
    number, date (+ the weekday printed), call / ready / end-of-shoot / wrap times,
    the day's scenes (id, story day, INT/EXT, day/night, set, synopsis, cast ids, pages, location),
    the cast list (id, role, actor), department notes per scene (Suono, Regia, Costumi…),
    and the "avanzamento": the NEXT day's scenes, printed on page 2.

    python pipeline/read_odg.py "path/to/LBE - ODG#6.pdf"
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

MONTHS = {m: i + 1 for i, m in enumerate(
    ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
     "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"])}
WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
DATE_RE = re.compile(r"(" + "|".join(WEEKDAYS) + r")\s+(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
SCENE_ID_RE = re.compile(r"^\d+\s*[A-Za-z]*$")  # 27 · 27A · 27fin · "27 fin" (ODG #14)
INT_EXT_RE = re.compile(r"^([IE](?:\s*[-/]\s*[IE])?)\s*/\s*([A-Z]+)$")  # I / G · I-E / N · E / T
CAST_RE = re.compile(r"^\d+(\s*,\s*\d+)*$")
PAGES_RE = re.compile(r"^(\d+\s+)?\d/8$|^\d+$")
TIME_RE = re.compile(r"^(\d{1,2})[.:](\d{2})$")
STANDBY_RE = re.compile(r"^STAND[\s-]*BY:?$", re.I)  # table heading before the stand-by scenes
DEPARTMENTS = ["Camera", "Scenografia", "Props", "Costumi", "Trucco/Capelli", "Suono", "Veicoli",
               "Animali", "Stunt", "VFX/AI", "SFX/Armi", "Regia", "Produzione"]


def clean(text):
    return re.sub(r"\s+", " ", text.replace("–", "-").replace("—", "-")).strip()


def as_time(text):
    match = TIME_RE.match(text.strip())
    return f"{int(match.group(1)):02d}:{match.group(2)}" if match else ""


def read_date(text):
    """'Lunedì 28 Settembre 2026' → ('2026-09-28', 'lunedì')."""
    match = DATE_RE.search(text)
    if not match:
        return "", ""
    weekday, day, month, year = match.groups()
    return f"{year}-{MONTHS[month.lower()]:02d}-{int(day):02d}", weekday.lower()


def value_after(lines, label):
    """The value printed after a label, on the same line or the next one."""
    for i, line in enumerate(lines):
        if line.lower().startswith(label.lower()):
            rest = line[len(label):].strip(" :")
            return rest or (lines[i + 1] if i + 1 < len(lines) else "")
    return ""


def join_wrapped_cast(lines):
    """A long cast list wraps: '1, 2, 3, … 9,' + '11, 12, 13' → one line."""
    joined = []
    for line in lines:
        if joined and re.fullmatch(r"(\d+\s*,\s*)+", joined[-1]) and re.match(r"^\d", line):
            joined[-1] = f"{joined[-1]} {line}"
        else:
            joined.append(line)
    return joined


def read_scene_table(lines):
    """Scenes from the table between 'LOCATION / NOTE' and 'Tot.'."""
    starts = [i for i in range(len(lines) - 3)
              if SCENE_ID_RE.match(lines[i]) and INT_EXT_RE.match(lines[i + 2])]
    scenes = []
    standby = False  # a "STAND BY:" heading in the table: the scenes after it are stand-by scenes
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[start:end]
        int_ext, day_night = INT_EXT_RE.match(block[2]).groups()
        synopsis, cast, pages = [], [], ""
        rest = join_wrapped_cast(block[4:])
        for k, line in enumerate(rest):
            if CAST_RE.match(line) and not ("/8" in line):
                following = rest[k + 1] if k + 1 < len(rest) else ""
                if PAGES_RE.match(following):
                    cast, pages, location = [c.strip() for c in line.split(",")], following, rest[k + 2:]
                else:  # no cast listed: this number is the page count
                    pages, location = line, rest[k + 1:]
                break
            if "/8" in line and PAGES_RE.match(line):
                pages, location = line, rest[k + 1:]
                break
            synopsis.append(line)
        else:
            location = []
        heading = next((k for k, line in enumerate(location) if STANDBY_RE.match(line)), None)
        scenes.append({
            "scene_id": re.sub(r"\s+", "", block[0]), "story_day": block[1],
            "int_ext": {"I": "INT", "E": "EXT"}.get(re.sub(r"[\s/-]", "", int_ext), "INT/EXT"),
            "day_night": day_night, "set": clean(block[3]), "synopsis": clean(" ".join(synopsis)),
            "cast": cast, "pages": pages, "location": clean(" ".join(location[:heading])),
            "standby": standby,
        })
        if heading is not None:  # the heading was read with this scene's location: it belongs to the next ones
            standby = True
    return scenes


def section(lines, start_marker, end_marker, start_at=0):
    start = next((i for i in range(start_at, len(lines)) if lines[i].startswith(start_marker)), None)
    if start is None:
        return [], len(lines)
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith(end_marker)), len(lines))
    return lines[start + 1:end], end


def read_cast(lines):
    """Cast rows: ID, role, actor (the actor may be missing), then codes and times."""
    header = next((i for i, line in enumerate(lines) if line == "RUOLO"), None)
    if header is None:
        return []
    start = next(i for i in range(header, len(lines)) if lines[i] == "SET") + 1
    end = next((i for i in range(start, len(lines)) if lines[i].startswith("Note Cast")), len(lines))
    body = lines[start:end]
    cast = []
    for i, line in enumerate(body):
        role_follows = i + 2 < len(body) and re.fullmatch(r"[A-ZÀ-Þ][A-ZÀ-Þ .'’0-9-]*", body[i + 1])
        if re.fullmatch(r"\d+", line) and role_follows and not any(c["id"] == line for c in cast):
            actor = body[i + 2]
            if re.fullmatch(r"[A-Z]{1,3}", actor):  # that's the SWF code: no actor printed
                actor = ""
            cast.append({"id": line, "role": clean(body[i + 1]), "actor": clean(actor)})
    return cast


def read_notes(lines, start_marker, end_marker):
    """Department notes, split per scene: {'2': {'Suono': '...', 'Regia': '...'}}.
    A note like 'Sc 11 / 8 / 13 Blackout…' belongs to all three scenes; a line without
    'Sc.' continues the previous note."""
    body, _ = section(lines, start_marker, end_marker)
    notes, department, current = {}, None, []
    for line in body:
        if line in DEPARTMENTS:
            department, current = line, []
            continue
        if not department:
            continue
        parts = re.split(r"(?=Sc\.?\s*\d)", line)
        for part in parts:
            match = re.match(r"Sc\.?\s*((?:\d+[A-Za-z]{0,3}\s*/?\s*)+)(.*)", part.strip())
            if match:
                current = re.findall(r"\d+[A-Za-z]{0,3}", match.group(1))
                text = clean(match.group(2)).strip(" -")
                for scene_id in current:
                    if text:
                        notes.setdefault(scene_id, {})[department] = text
            elif current and part.strip():  # continuation of the previous note
                for scene_id in current:
                    old = notes.setdefault(scene_id, {}).get(department, "")
                    notes[scene_id][department] = clean(f"{old} {part}").strip(" -")
    return notes


def read_odg(path):
    lines = [clean(line) for page in fitz.open(path) for line in page.get_text().splitlines()]
    lines = [line for line in lines if line]
    text = "\n".join(lines)

    first_page, advance_at = section(lines, "LOCATION / NOTE", "Tot.")
    advance_header = next((l for l in lines if l.startswith("AVANZAMENTO")), "")
    advance_lines, _ = section(lines, "LOCATION / NOTE", "Tot.", start_at=advance_at)
    date, weekday = read_date(text)
    number = re.search(r"ODG\s*#\s*(\d+)", text)
    advance_day = re.search(r"DAY\s*#\s*(\d+)", advance_header)
    advance_date, advance_weekday = read_date(advance_header)
    advance_times = re.findall(r"\d{1,2}[.:]\d{2}", lines[lines.index(advance_header) + 1]) if advance_header else []

    return {
        "number": int(number.group(1)) if number else None,
        "date": date, "weekday_printed": weekday,
        "call": as_time(value_after(lines, "CONVOCAZIONE")),
        "ready_to_shoot": as_time(value_after(lines, "Pronti a girare")),
        "end_of_shoot": as_time(value_after(lines, "Fine Riprese")),
        "wrap": as_time(value_after(lines, "Fine Lavorazione")),
        "scenes": read_scene_table(first_page),
        "cast": read_cast(lines),
        "notes": read_notes(lines, "FABBISOGNI REPARTI", "AVANZAMENTO"),
        "advance": advance_header and {
            "day": int(advance_day.group(1)) if advance_day else None, "date": advance_date,
            "weekday_printed": advance_weekday,
            "call": as_time(advance_times[0]) if advance_times else "",
            "wrap": as_time(advance_times[1]) if len(advance_times) > 1 else "",
            "scenes": read_scene_table(advance_lines),
            "notes": read_notes(lines, "FABBISOGNI REPARTI - AVANZAMENTO", "È assolutamente vietato"),
        },
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_odg(sys.argv[1]), ensure_ascii=False, indent=1))
