"""read_pdl.py — reads a shooting schedule (PDL, "piano di lavorazione") and its scaletta
into plain data. Port of the LBE breakdown parser (projects/la-buona-educazione/work/parse_pdl.py).

Both PDFs use the same block per scene:
    INT|EXT|INT/EXT · set · synopsis · scene id · [location] · pages · [cast ids] · minors ·
    extras · flags… · time of day · DAY <story day> · notes…
The PDL groups the blocks by shooting day, each closed by
    "---- End of Day # 6 - lunedì 28 settembre 2026 - 4 5/8 pag. ----"
with "orario previsto 09:00-17:00" before the day's scenes and "FINE SETTIMANA 1" after a week.
The scaletta lists every scene in script order (also scenes with no shooting day yet).
Note: both documents cut long synopses (only the ODG has the full text).

    python pipeline/read_pdl.py "path/to/LBE_PDL_1809.pdf" ["path/to/LBE_SCALETTA_1809.pdf"]
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

INT_EXT = {"INT", "EXT", "INT/EXT", "EXT/INT"}
TIMES = {"GIORNO", "NOTTE", "TRAMONTO", "MATTINA", "SERA", "ALBA"}
FLAGS = {"ARMI", "ANIMALI", "FDS", "VEICOLI", "S.EQ", "SFX", "STUNT", "STEADYCAM", "2° MDP", "2°MDP", "MINORS:", "EXTRAS:"}
PAGES_RE = re.compile(r"^(?:\d+\s+\d/8|\d+|\d/8)$")
SCENE_RE = re.compile(r"^\d+[A-Za-z]*$")
CAST_RE = re.compile(r"^\d+(?:\s*,\s*\d+)*,?$")
DAY_RE = re.compile(r"^DAY\s+(.+)$", re.I)
END_RE = re.compile(r"End of Day\s*#\s*(\d+)\s*-\s*\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})", re.I)
ORARIO_RE = re.compile(r"orario previsto\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", re.I)
MONTHS = {m: i + 1 for i, m in enumerate(["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
                                           "agosto", "settembre", "ottobre", "novembre", "dicembre"])}


def lines_of(path):
    return [t for page in fitz.open(path) for raw in page.get_text().splitlines()
            if (t := raw.replace("\xa0", " ").strip())]


def read_block(block):
    """One scene block, starting at its INT/EXT line."""
    rest = block[3:]
    at = next((i for i, line in enumerate(rest) if SCENE_RE.match(line)), None)
    if at is None:
        return None
    scene = {"scene_id": rest[at], "int_ext": block[0], "set": block[1] if len(block) > 1 else "",
             "synopsis": " ".join(block[2:3] + rest[:at]), "location": "", "pages": "", "cast": [],
             "time_of_day": "", "story_day": "", "notes": ""}
    tail = rest[at + 1:]
    if tail and not PAGES_RE.match(tail[0]):
        scene["location"] = tail.pop(0)
    if tail and PAGES_RE.match(tail[0]):
        scene["pages"] = tail.pop(0)
    numbers, notes = [], []
    for line in tail:
        if line.upper() in FLAGS:
            continue
        if line.upper() in TIMES:
            scene["time_of_day"] = line.capitalize()
        elif DAY_RE.match(line):
            scene["story_day"] = DAY_RE.match(line).group(1).strip()
        elif CAST_RE.match(line):
            if numbers and numbers[-1].endswith(","):  # a long cast list wraps onto the next line
                numbers[-1] += " " + line
            else:
                numbers.append(line)
        else:
            notes.append(line)
    # the last two numbers are the minors and extras counters; before them, the cast
    for line in numbers[:-2]:
        scene["cast"] += re.findall(r"\d+", line)
    scene["notes"] = " ".join(notes)
    return scene


def blocks(lines):
    """('scene', lines) · ('end', match) · ('other', line), in page order."""
    current = None
    for line in lines:
        if line in INT_EXT:
            if current:
                yield "scene", current
            current = [line]
        elif END_RE.search(line):
            if current:
                yield "scene", current
                current = None
            yield "end", END_RE.search(line)
        elif current is not None:
            current.append(line)
        else:
            yield "other", line


def read_cast(lines):
    """The cast index at the top: 'INES', '1.', 'EMANUELA LE FAVRE', '2.' … → {'1': 'INES', …}"""
    cast, name = {}, None
    start = lines.index("CAST") + 1 if "CAST" in lines[:5] else len(lines)
    for line in lines[start:start + 80]:
        if re.fullmatch(r"\d+\.", line) and name:
            cast[line.rstrip(".")] = name
            name = None
        elif re.fullmatch(r"[A-ZÀ-Þ][A-ZÀ-Þ' .\-0-9]*", line) and not line.startswith("PDL"):
            name = line
        else:
            break
    return cast


def read_pdl(pdl_path, scaletta_path=None):
    lines = lines_of(pdl_path)
    days, scenes, call, wrap, week = [], [], "", "", 1
    for kind, item in blocks(lines):
        if kind == "scene":
            scene = read_block(item)
            if scene:
                scenes.append(scene)
        elif kind == "other":
            times = ORARIO_RE.search(item)
            if times:
                call, wrap = (f"{int(t.split(':')[0]):02d}:{t.split(':')[1]}" for t in times.groups())
            elif item.upper().startswith("FINE SETTIMANA"):
                week += 1
        else:  # end of a shooting day
            number, day, month, year = item.groups()
            days.append({"day": int(number), "date": f"{year}-{MONTHS[month.lower()]:02d}-{int(day):02d}",
                         "week": week, "call": call, "wrap": wrap, "scenes": scenes})
            scenes, call, wrap = [], "", ""
    all_scenes = {}
    if scaletta_path:
        for kind, item in blocks(lines_of(scaletta_path)):
            scene = read_block(item) if kind == "scene" else None
            if scene:
                all_scenes[scene["scene_id"]] = scene
    for day in days:
        for scene in day["scenes"]:
            all_scenes.setdefault(scene["scene_id"], scene)
    return {"cast": read_cast(lines), "days": days, "scenes": all_scenes}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    result = read_pdl(*sys.argv[1:3])
    print(json.dumps(result, ensure_ascii=False, indent=1)[:3000])
    print(f"\n{len(result['cast'])} cast · {len(result['days'])} days · "
          f"{sum(len(d['scenes']) for d in result['days'])} scheduled scenes · {len(result['scenes'])} scenes in total")
