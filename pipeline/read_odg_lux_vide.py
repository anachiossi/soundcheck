"""read_odg_lux_vide.py — reads a call sheet in Lux Vide's layout (Confine, Nov 2026) into the SAME data as
read_odg.py (the LBE / Memo Films layout), so the robot and the proposals work unchanged.
A film uses it when its settings.json says "odg_reader": "lux-vide" (odg_reader.py picks it).

What this layout prints (ODG #26, 5 Nov 2026), page 1:
    "ODG #26" · "Giovedì, 5 Novembre 2026" · "Convocazione troupe:" 08.00 · "Pronti a girare:" 08.30 ·
    "Fine Riprese:" / "Fine Lavorazione:" with their two times after them (15.30, 16.00)
    the scene table: SCENA · I/E · LUCE · AMBIENTE · SINOSSI · ID (cast) · PAG · DAY (story day)
    CONVOCAZIONE ATTORI: ID · RUOLO ("Lorenzo Magni") · ATTORE · SCENE · P/UP · T/C · COST · PRONTI · SET
    FABBISOGNI in two columns of departments: FABBISOGNI | MEZZI DI SCENA, COSTUMI | CONTRIBUTI,
    NOTE REGIA | NOTE PRODUZIONE, each item "612-513: Moto Giorgio"
page 2: the crew, then "PROGRAMMA DEL GIORNO SUCCESSIVO, VENERDÌ 6 NOVEMBRE – ORARIO 08.00 – 18.00" + the same table
The text runs the columns together ("E G CHIESETTA SCONSACRATA Lorenzo scopre…"), so every word goes to its
column by where it is printed (x). A synopsis printed on two lines sits around its scene number, above and below.

    python pipeline/read_odg_lux_vide.py "path/to/CNF_ODG_#26.pdf"
"""

import json
import re
import sys

from read_odg import MONTHS, as_time, clean, read_date

SCENE_ID_RE = re.compile(r"^\d+[A-Za-z]*\d*$")          # 612 · 612A · 612pt1
CAPITALS_RE = re.compile(r"^[A-ZÀ-Þ0-9'’/.\-–()]+$")    # a word of the set's name (AMBIENTE is in capitals)
TIME_RE = re.compile(r"^\d{1,2}[.:]\d{2}$")
# where each column of the scene table starts (x, the page is 595 wide): read on ODG #26, both pages
SCENE_COLUMNS = (("scene", 0), ("int_ext", 56), ("light", 72), ("text", 84), ("cast", 488), ("pages", 520), ("day", 549))
SYNOPSIS_X = 185          # set names end before it, synopses start after it
CAST_COLUMNS = (("id", 0), ("role", 50), ("actor", 135), ("scenes", 240), ("times", 410))
NEEDS_RIGHT_X = 300       # the needs are printed in two columns
DEPARTMENTS = {"FABBISOGNI": "Props", "MEZZI DI SCENA": "Veicoli", "COSTUMI": "Costumi", "CONTRIBUTI": "Contributi",
               "NOTE REGIA": "Regia", "NOTE PRODUZIONE": "Produzione", "SUONO": "Suono", "TRUCCO": "Trucco/Capelli",
               "SFX": "SFX/Armi", "ARMI": "SFX/Armi", "STUNT": "Stunt", "ANIMALI": "Animali", "VFX": "VFX/AI",
               "SCENOGRAFIA": "Scenografia", "ARREDAMENTO": "Scenografia", "MACCHINA": "Camera"}
NEEDS_RE = re.compile(r"^(\d+[A-Za-z]*\d*(?:\s*[-,/]\s*\d+[A-Za-z]*\d*)*)\s*:\s*(.*)$")   # '612-513: Moto Giorgio'


def column_of(x, columns):
    return [name for name, start in columns if x >= start - 0.5][-1]


def words_of(page):
    """[(y, x, word)] of one page, top to bottom."""
    return sorted((round(w[1]), w[0], w[4]) for w in page.get_text("words"))


def lines_of(page):
    """[(y, x, text)] of one page: the printed lines (pieces of text), top to bottom."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = clean("".join(span["text"] for span in line["spans"]))
            if text:
                out.append((round(line["bbox"][1]), line["bbox"][0], text))
    return sorted(out)


def read_scene_table(words, top, bottom):
    """The scenes printed between two heights of a page (the table's header and what comes after it)."""
    inside = [(y, x, w) for y, x, w in words if top < y < bottom]
    starts = [(y, w) for y, x, w in inside if x < SCENE_COLUMNS[1][1] and SCENE_ID_RE.match(w)]
    if not starts:
        return []
    cells = {scene_id: {} for _, scene_id in starts}
    for y, x, word in inside:
        if x < SCENE_COLUMNS[1][1] and SCENE_ID_RE.match(word):
            continue
        # the nearest scene number (a synopsis on two lines sits above and below its number)
        distance, scene_id = min((abs(y - start_y), sid) for start_y, sid in starts)
        column = column_of(x, SCENE_COLUMNS)
        if column in ("int_ext", "light", "cast", "pages", "day") and distance > 4:
            continue  # the table's total ("5 6/8") under the last scene
        if column == "text":
            column = "set" if x < SYNOPSIS_X and CAPITALS_RE.match(word) else "synopsis"
        cells[scene_id].setdefault(column, []).append(word)
    scenes = []
    for _, scene_id in starts:
        cell = {name: " ".join(words) for name, words in cells[scene_id].items()}
        int_ext = cell.get("int_ext", "").replace(" ", "")
        scenes.append({
            "scene_id": scene_id, "story_day": cell.get("day", ""),
            "int_ext": {"I": "INT", "E": "EXT"}.get(int_ext, "INT/EXT" if int_ext else ""),
            "day_night": cell.get("light", ""), "set": cell.get("set", ""), "synopsis": cell.get("synopsis", ""),
            "cast": re.findall(r"\d+", cell.get("cast", "")), "pages": cell.get("pages", ""),
            "location": "", "standby": False,
        })
    return scenes


def read_cast(lines, top, bottom):
    """CONVOCAZIONE ATTORI: [{id, role, actor}] (the role as printed, in capitals: 'LORENZO MAGNI')."""
    rows = {}
    for y, x, text in lines:
        if top < y < bottom:
            rows.setdefault(y, []).append((x, text))
    cast = []
    for y in sorted(rows):
        cells = {}
        for x, text in rows[y]:
            cells.setdefault(column_of(x, CAST_COLUMNS), []).append(text)
        number = " ".join(cells.get("id", []))
        joined = re.fullmatch(r"(\d+)\s+(.+)", number)  # '12 Filippo Lo Bianco': a 2-digit id printed close to its role
        if joined:
            number = joined.group(1)
            cells["role"] = [joined.group(2)] + cells.get("role", [])
        # a scene number printed further left than its column ('Valentina Ghelfi 828', ODG #27): names have no digits
        actor = " ".join(word for word in " ".join(cells.get("actor", [])).split() if not re.match(r"\d", word))
        if re.fullmatch(r"\d+", number) and cells.get("role"):
            cast.append({"id": number, "role": " ".join(cells["role"]).upper(), "actor": actor})
    return cast


def read_needs(lines, top, scene_ids):
    """FABBISOGNI → {'612': {'Veicoli': 'Moto Giorgio'}}. A line with no scene numbers goes on with the item above
    it in the same column; scenes written '612-513' are a list (never a range)."""
    items = {"left": [], "right": []}
    department = {"left": None, "right": None}
    for y, x, text in lines:
        if y <= top:
            continue
        side = "right" if x >= NEEDS_RIGHT_X else "left"
        if text.upper() in DEPARTMENTS:
            department[side] = DEPARTMENTS[text.upper()]
            continue
        if not department[side]:
            continue
        match = NEEDS_RE.match(text)
        if match:
            items[side].append([department[side], re.findall(r"\d+[A-Za-z]*\d*", match.group(1)), match.group(2)])
        elif items[side] and items[side][-1][0] == department[side]:
            items[side][-1][2] += " " + text
        else:
            items[side].append([department[side], list(scene_ids), text])   # no scene numbers: the whole day
    notes = {}
    for name, scenes, text in items["left"] + items["right"]:
        for scene_id in scenes:
            if scene_id in scene_ids:
                by_department = notes.setdefault(scene_id, {})
                by_department[name] = "; ".join(filter(None, [by_department.get(name), clean(text)]))
    return notes


def first_y(lines, start):
    """The height of the first line that starts with these words (capitals or not), or None."""
    return next((y for y, x, text in lines if text.upper().startswith(start)), None)


def time_after(lines, label, which=0):
    """The time printed after a label: 'Convocazione troupe:' then '08.00'. Fine Riprese and Fine Lavorazione are
    printed one under the other, then their two times: which=0 the first, 1 the second."""
    texts = [text for _, _, text in lines]
    for i, text in enumerate(texts):
        if text.upper().startswith(label.upper()):
            times = [t for t in texts[i + 1:i + 5] if TIME_RE.match(t)]
            return as_time(times[which]) if len(times) > which else ""
    return ""


def advance_date(header, year):
    """'PROGRAMMA DEL GIORNO SUCCESSIVO, VENERDÌ 6 NOVEMBRE – ORARIO 08.00 – 18.00' → '2026-11-06' (no year printed)."""
    match = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")", header, re.I)
    return f"{year}-{MONTHS[match.group(2).lower()]:02d}-{int(match.group(1)):02d}" if match else ""


def read_lux_vide(pages):
    """pages = [(words, lines)] of each PDF page (words_of, lines_of)."""
    first_words, first_lines = pages[0]
    text = "\n".join(t for _, _, t in first_lines)
    number = re.search(r"ODG\s*#\s*(\d+)", text)
    date, weekday = read_date(text.replace(",", ""))   # "Giovedì, 5 Novembre 2026"
    header_y = next((y for y, x, w in first_words if w == "SCENA" and x < 60), 0)
    cast_y = first_y(first_lines, "CONVOCAZIONE ATTORI") or 10_000
    needs_y = next((y for y, x, t in first_lines if t.upper() == "FABBISOGNI" and y > cast_y), 10_000)
    scenes = read_scene_table(first_words, header_y + 2, cast_y)
    day = int(number.group(1)) if number else None
    advance = None
    for words, lines in pages[1:]:
        header = next(((y, t) for y, x, t in lines if t.upper().startswith("PROGRAMMA DEL GIORNO SUCCESSIVO")), None)
        if not header:
            continue
        table_y = next((y for y, x, w in words if w == "SCENA" and x < 60 and y > header[0]), header[0])
        end_y = first_y([l for l in lines if l[0] > table_y], "DIRETTORE DI PRODUZIONE") or 10_000
        times = re.findall(r"\d{1,2}[.:]\d{2}", header[1].split("ORARIO")[-1])
        advance_scenes = read_scene_table(words, table_y + 2, end_y)
        advance = {
            "day": day + 1 if day else None,  # this layout doesn't print the next day's number: the next shooting day
            "date": advance_date(header[1], date[:4] or "2026"), "weekday_printed": "",
            "call": as_time(times[0]) if times else "", "wrap": as_time(times[1]) if len(times) > 1 else "",
            "scenes": advance_scenes, "notes": {},
        }
    return {
        "number": day, "date": date, "weekday_printed": weekday,
        "call": time_after(first_lines, "Convocazione troupe"), "ready_to_shoot": time_after(first_lines, "Pronti a girare"),
        "end_of_shoot": time_after(first_lines, "Fine Riprese", 0), "wrap": time_after(first_lines, "Fine Riprese", 1),
        "scenes": scenes, "cast": read_cast(first_lines, cast_y + 12, needs_y),
        "notes": read_needs(first_lines, needs_y - 1, [s["scene_id"] for s in scenes]),
        "advance": advance or {},
    }


def read_odg_lux_vide(path):
    """The PDF → the same data as read_odg() in read_odg.py."""
    import pymupdf as fitz
    return read_lux_vide([(words_of(page), lines_of(page)) for page in fitz.open(path)])


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_odg_lux_vide(sys.argv[1]), ensure_ascii=False, indent=1))
