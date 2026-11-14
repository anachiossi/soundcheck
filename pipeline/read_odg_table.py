"""read_odg_table.py — reads ANY call sheet (ODG) whose scenes are printed as a table with a header row,
into the SAME data as read_odg.py. It is driven by a template of words (odg_template.py), not by positions:

    1. the PDF library finds the tables on each page (their rows and cells)
    2. the scene table is the one whose header row names a scene column and two more ("SCENA · LUCE · CAST…")
    3. each cell under the header goes to the column whose header it sits under
    4. the date, the ODG number and the times are found by their labels ("CONVOCAZIONE", "FINE LAVORAZIONE")

A film uses it with settings.json "odg_reader": "table" (odg_reader.py). The robot also runs it next to every
film's own reader as a second opinion (reading_checks.py: when the two disagree, the proposal says so).
Not read here: the department notes (each production writes them its own way).

    python pipeline/read_odg_table.py "path/to/odg.pdf"
"""

import json
import re
import sys

from odg_template import DEFAULT_TEMPLATE, fields_named, plain
from pdf_tables import pages_of
from read_odg import MONTHS, as_time, clean, read_date

SCENE_ID_RE = re.compile(r"^\d+\s*[A-Za-z]{0,6}\s*(?:pt\s*)?\d*$")   # 27 · 27A · "27 fin" · 517pt1 · "526C pt1"
TIME_RE = re.compile(r"\d{1,2}[.:]\d{2}")
INT_EXT_RE = re.compile(r"^\s*([IE](?:\s*[-/+]\s*[IE])?)\b")       # I · E · I-E · I/E · I+E


def header_of(row, columns):
    """A header row → [{field names, x0, x1}], or [] when this row isn't a header. Pieces of one header word
    printed in separate cells ("TI" "MELIN" "E", "I" "-E / G-N") are put together first."""
    cells, i = [], 0
    while i < len(row):
        for size in (1, 2, 3):
            group = row[i:i + size]
            text = "".join(cell["text"].splitlines()[-1] for cell in group)  # the last line: "u⏎SET/SINOSSI"
            fields = fields_named(text, columns)
            if fields and len(group) == size:
                cells.append({"fields": fields, "x0": group[0]["x0"], "x1": group[-1]["x1"]})
                i += size - 1
                break
        i += 1
    return cells


def column_of(cell, header):
    """The header cell this cell sits under: the one it overlaps most, else the nearest."""
    def overlap(head):
        return min(cell["x1"], head["x1"]) - max(cell["x0"], head["x0"])
    def distance(head):
        return abs((cell["x0"] + cell["x1"]) / 2 - (head["x0"] + head["x1"]) / 2)
    best = max(header, key=lambda head: (overlap(head) > 0, overlap(head) if overlap(head) > 0 else -distance(head)))
    return best


def scene_of(values):
    """One table row's values (by field) → a scene, as read_odg.py gives it."""
    int_ext, light = values.get("int_ext", ""), values.get("light", "")
    both = clean(f"{int_ext} {light}")              # "I / N" in one column, or "I" and "N" in two
    match = INT_EXT_RE.match(both)
    letters = re.sub(r"[\s/+-]", "", match.group(1)) if match else ""
    rest = both[match.end():].strip(" /") if match else both
    set_text, synopsis = values.get("set", ""), values.get("synopsis", "")
    if "set" in values and "synopsis" not in values and "\n" in set_text:
        set_text, synopsis = set_text.split("\n", 1)   # "SET / SINOSSI" in one column: first line, then the rest
    cast = values.get("cast", "")
    return {
        "scene_id": re.sub(r"\s+", "", values["scene"]), "story_day": clean(values.get("story_day", "")),
        "int_ext": {"I": "INT", "E": "EXT"}.get(letters, "INT/EXT" if letters else ""),
        "day_night": rest.split()[0] if rest else "", "set": clean(set_text), "synopsis": clean(synopsis),
        "cast": re.findall(r"\d+", cast), "pages": clean(values.get("pages", "")),
        "location": clean(values.get("location", "")), "standby": False,
    }


def read_scene_table(rows, header, template):
    """The rows under a header → (scenes, units found, the total pages printed)."""
    scenes, units, total, unit, standby = [], [], "", None, False
    unit_re = re.compile(r"^(?:" + "|".join(re.escape(w) for w in template["unit"]) + r")\s+([A-ZÀ-Þ' ]+?)(?=\s*[-–:(]|\s+\d|\s+ORARIO|$)", re.I)
    for row in rows:
        whole = clean(" ".join(cell["text"] for cell in row))
        named = unit_re.match(whole)
        if named:
            times = TIME_RE.findall(whole)
            unit = {"name": named.group(1).strip().title(), "call": as_time(times[0]) if times else "",
                    "wrap": as_time(times[1]) if len(times) > 1 else ""}
            units.append(unit)
            continue
        if any(plain(whole).startswith(plain(word)) for word in template["standby"]):
            standby = True
            continue
        values = {}
        for cell in row:
            fields = column_of(cell, header)["fields"]
            field = fields[0] if fields[0] not in values else fields[-1]
            values[field] = (values[field] + " " if field in values else "") + cell["text"]
        if any(plain(whole).startswith(plain(word)) for word in template["total"]):
            total = clean(values.get("pages", "")) or total
            continue
        # several scene numbers stacked in one cell ("619⏎626⏎626CV", shot together): one scene each, the
        # pages on the first. "136⏎DRONE" is one number with a word: 136DRONE.
        stacked = [line for line in values.get("scene", "").splitlines() if line.strip()]
        numbers = stacked if len(stacked) > 1 and all(SCENE_ID_RE.match(line.strip()) for line in stacked) \
            else [clean(values.get("scene", ""))]
        for position, number in enumerate(numbers):
            if not SCENE_ID_RE.match(number.strip()):
                continue
            scene = scene_of({**values, "scene": number, **({"pages": ""} if position else {})})
            scene["standby"] = standby
            if unit:
                scene["unit_name"] = unit["name"]
            scenes.append(scene)
    return scenes, units, total


def read_cast_table(rows, header):
    cast = []
    for row in rows:
        values = {}
        for cell in row:
            values.setdefault(column_of(cell, header)["fields"][0], cell["text"])
        number = clean(values.get("id", ""))
        if re.fullmatch(r"\d+", number) and values.get("role") and not any(c["id"] == number for c in cast):
            cast.append({"id": number, "role": clean(values["role"]).upper(), "actor": clean(values.get("actor", ""))})
    return cast


def time_after(lines, labels, main_unit=None):
    """The first time printed on a label's line or the 4 lines after it. A two-unit day prints each label once
    per unit ("CONVOCAZIONE UNITA’ DE FEUDIS", "CONVOCAZIONE UNITA’ ALFIERI"): the main unit's line is taken."""
    found = [i for i, line in enumerate(lines) if any(line.upper().startswith(label.upper()) for label in labels)]
    name = plain(main_unit)
    of_main = [i for i in found if name and name in plain(lines[i])]
    for i in (of_main or found)[:1]:
        times = TIME_RE.findall(" ".join(lines[i:i + 5]))
        return as_time(times[0]) if times else ""
    return ""


def next_day_facts(lines, start, number, year):
    """The next day's number, date and hours, from the line that announces it and the two after."""
    text = " ".join(lines[start:start + 3])
    date, weekday = read_date(text.replace(",", ""))
    if not date:  # "VENERDÌ 6 NOVEMBRE" with no year: the ODG's year
        match = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")", text, re.I)
        date = f"{year}-{MONTHS[match.group(2).lower()]:02d}-{int(match.group(1)):02d}" if match else ""
    day = re.search(r"DAY\s*#\s*(\d+)", text)
    times = TIME_RE.findall(re.sub(r"\d{1,2}[.:]\d{2}[.:]\d{2,4}", "", text))
    return {"day": int(day.group(1)) if day else (number + 1 if number else None), "date": date,
            "weekday_printed": weekday, "call": as_time(times[0]) if times else "",
            "wrap": as_time(times[1]) if len(times) > 1 else ""}


def with_units(scenes, units, main_unit):
    """Marks the scenes of every unit but the main one as the 2nd unit's. → (second unit or None, warnings)."""
    names = [unit["name"] for unit in units]
    if len(set(names)) < 2:
        for scene in scenes:
            scene.pop("unit_name", None)
        return None, []
    main = next((name for name in names if main_unit and name.upper() == main_unit.upper()), names[0])
    warnings = [] if main_unit and main.upper() == main_unit.upper() else [
        f'Two units on this ODG ({", ".join(dict.fromkeys(names))}): "{main}" was taken as the main one '
        f'(settings.json "main_unit" says "{main_unit or "nothing"}").']
    second = None
    for scene in scenes:
        if scene.get("unit_name", main) == main:
            scene.pop("unit_name", None)
        else:
            scene["unit"] = "2nd"
            second = second or next(unit for unit in units if unit["name"] == scene["unit_name"])
    return second, warnings


def read_table_pages(pages, template=None, main_unit=None):
    """pages = [{'lines': [text…], 'tables': [{'line': index in lines of the table's top, 'rows': [[cell…]]}]}],
    a cell = {'x0', 'x1', 'text'}. Plain data in, plain data out (tests/test_read_odg_table.py)."""
    template = template or DEFAULT_TEMPLATE
    lines = [line for page in pages for line in page["lines"]]
    text = "\n".join(lines)
    number = re.search(r"ODG\s*#?\s*(\d+)", text)
    number = int(number.group(1)) if number else None
    date, weekday = read_date(text.replace(",", ""))
    next_at = next((i for i, line in enumerate(lines)
                    if any(line.upper().startswith(word) for word in template["next_day"])), None)
    today = {"scenes": [], "units": [], "total": ""}
    tomorrow = {"scenes": [], "units": [], "total": ""}
    cast, offset, announced = [], 0, 0  # announced: how many "next day" rows were met inside the tables
    for page in pages:
        for table in page["tables"]:
            day = tomorrow if next_at is not None and offset + table["line"] >= next_at else today
            # one printed table may hold several: today's scenes, the cast, tomorrow's scenes. Each part starts
            # at its own header row; the row that announces the next day switches to tomorrow.
            kind, header, part = None, None, []

            def close_part():
                if kind == "cast" and not cast:
                    cast.extend(read_cast_table(part, header))
                if kind == "scenes":
                    scenes, units, total = read_scene_table(part, header, template)
                    day["scenes"] += scenes
                    day["units"] += units
                    day["total"] = day["total"] or total

            for row in table["rows"]:
                whole = clean(" ".join(cell["text"] for cell in row)).upper()
                as_cast = header_of(row, template["cast_columns"])
                as_scenes = header_of(row, template["columns"])
                is_cast = any("role" in cell["fields"] for cell in as_cast) and len(as_cast) >= 2
                is_scenes = not is_cast and any("scene" in cell["fields"] for cell in as_scenes) and len(as_scenes) >= 3
                announces = any(whole.startswith(word) for word in template["next_day"])
                if is_cast or is_scenes or announces:
                    close_part()
                    part = []
                    kind, header = ("cast", as_cast) if is_cast else ("scenes", as_scenes) if is_scenes else (None, None)
                    if announces:  # the first announcement is tomorrow; a second one (the day after) is not read
                        announced += 1
                        day = tomorrow if announced == 1 else {"scenes": [], "units": [], "total": ""}
                else:
                    part.append(row)
            close_part()
        offset += len(page["lines"])
    second, warnings = with_units(today["scenes"], today["units"], main_unit)
    advance = None
    if next_at is not None:
        advance_second, more = with_units(tomorrow["scenes"], tomorrow["units"], main_unit)
        advance = {**next_day_facts(lines, next_at, number, date[:4] or "2026"), "scenes": tomorrow["scenes"],
                   "second_unit": advance_second, "notes": {}}
        warnings += more
    labels = template["labels"]
    return {
        "number": number, "date": date, "weekday_printed": weekday,
        "call": time_after(lines, labels["call"], main_unit), "ready_to_shoot": time_after(lines, labels["ready_to_shoot"], main_unit),
        "end_of_shoot": time_after(lines, labels["end_of_shoot"], main_unit), "wrap": time_after(lines, labels["wrap"], main_unit),
        "scenes": today["scenes"], "cast": cast, "second_unit": second, "unit_warnings": warnings,
        "pages_total_printed": today["total"], "notes": {}, "advance": advance or {}, "reader": "table",
    }


def read_odg_table(path, template=None, main_unit=None):
    """The PDF → the same data as read_odg() in read_odg.py."""
    return read_table_pages(pages_of(path), template, main_unit)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_odg_table(sys.argv[1]), ensure_ascii=False, indent=1))
