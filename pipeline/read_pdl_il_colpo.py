"""read_pdl_il_colpo.py — reads a shooting schedule (PDL) in Il colpo's layout (from Nov 2026) into the SAME
data as read_pdl.py (the LBE layout), plus the 2nd unit. A film uses it when its settings.json says
"pdl_reader": "il-colpo" (pdl_reader.py picks it); read_pdl.py, the main reader, is not changed by it.

What this layout prints (PDL 02.11, days 55–68), read by the POSITION of each line on the page:
    centred:  "Day #56 - Orario di lavorazione: 15.00/23.00 - Wed 04/11/2026 - 8 6/8"   a day starts
              "Day Off - OFF - Sat 07/11/2026"                                           no shooting
              "UNITA' DE FEUDIS: Orario 8.00/16.00"   the 2nd unit starts: the rest of the day is its scenes
              any other centred line = a note for the day ("Verificare se 241 può essere DAY")
    a scene, in columns:
        x≈48   scene number (bigger type), then a letter on its own line ("330" · "A" = 330A); later the pages
        x≈72   "Int/Notte" · "Ext/Giorno" · "I+E/Notte" (sometimes with the set after it on the same line)
        x≈123  the set (may wrap), then, after the pages, the synopsis
        x≈275  the cast numbers: "1; 9, 11; 138, 146," (may wrap)
        x≈345  notes: extras, VFX, SFX, stunts…
The 2nd unit is stored as unit "2nd"; the name the PDL gives it ("DE FEUDIS", the 2nd unit director) is
kept only to show it (Ana, 3 Nov: "behind the scenes it is 2nd unit").

    python pipeline/read_pdl_il_colpo.py "path/to/IC_PDL.pdf"
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

DAY_RE = re.compile(r"^Day #(\d+)\s*-\s*Orario di lavorazione:\s*(.*?)\s*-\s*\w{3}\s+(\d{2})/(\d{2})/(\d{4})", re.I)
DAY_OFF_RE = re.compile(r"^Day Off\b", re.I)
UNIT_RE = re.compile(r"^UNIT[AÀ]'?\s*(.*)$", re.I)      # "UNITA' DE FEUDIS: Orario 8.00/16.00"
HOURS_RE = re.compile(r"(\d{1,2})(?:[.:](\d{2}))?\s*(?:-|/)\s*(\d{1,2})(?:[.:](\d{2}))?")  # 8.00/16.00 · 16:00 - 24:00 · 17/01
PAGES_RE = re.compile(r"^(?:\d+\s+\d/8|\d+|\d/8)$")
SCENE_RE = re.compile(r"^\d+$")
SUFFIX_RE = re.compile(r"^[A-Z]$")
INT_EXT = {"INT": "INT", "EXT": "EXT", "I+E": "INT/EXT", "E+I": "INT/EXT"}

# the columns: the left edge of each, in points (the page is 595 wide)
SCENE_X, INT_X, SET_X, CAST_X, NOTES_X = 48, 72, 123, 275, 345
CENTRED_FROM = 150  # day headers, unit lines and day notes start right of the set column


def page_lines(path):
    """Every line of text with its column: [(x, size, text)], page after page."""
    lines = []
    for page in fitz.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).replace("\xa0", " ").strip()
                if text:
                    lines.append((line["bbox"][0], line["spans"][0]["size"], text))
    return lines


def column(x):
    """Which column a line belongs to, from its left edge."""
    for name, edge in (("notes", NOTES_X), ("cast", CAST_X), ("set", SET_X), ("int", INT_X)):
        if x >= edge - 3:
            return name
    return "scene"


def hours(text):
    """'8.00/16.00' → ('08:00', '16:00'); '17/01' → ('17:00', '01:00'); nothing → ('', '')."""
    match = HOURS_RE.search(text)
    if not match:
        return "", ""
    call_h, call_m, wrap_h, wrap_m = match.groups()
    return f"{int(call_h):02d}:{call_m or '00'}", f"{int(wrap_h):02d}:{wrap_m or '00'}"


def new_scene(number):
    return {"scene_id": number, "int_ext": "", "time_of_day": "", "set": "", "synopsis": "", "pages": "",
            "location": "", "story_day": "", "cast": [], "notes": ""}


def add_line(scene, x, size, text):
    """One line of a scene block, put where its column says."""
    where = column(x)
    if where == "scene":
        if SUFFIX_RE.match(text) and not scene["pages"]:
            scene["scene_id"] += text                      # "330" then "A" → 330A
        elif PAGES_RE.match(text) and not scene["pages"]:
            scene["pages"] = text
    elif where == "int":
        kind, _, rest = text.partition(" ")                # "Int/Tramonto PALESTRA PAPERO/ZONA RING"
        int_ext, _, time = kind.partition("/")
        scene["int_ext"] = INT_EXT.get(int_ext.upper(), int_ext.upper())
        scene["time_of_day"] = time.capitalize()
        if rest:
            scene["set"] = rest.strip()
    elif where == "set":
        if text.startswith("Veicoli di Scena"):            # a note printed under the synopsis
            scene["notes"] = f"{scene['notes']} · {text}".strip(" ·")
        elif not scene["pages"]:
            scene["set"] = f"{scene['set']} {text}".strip()
        else:
            scene["synopsis"] = f"{scene['synopsis']} {text}".strip()
    elif where == "cast":
        scene["cast"] += re.findall(r"\d+", text)
    else:
        scene["notes"] = f"{scene['notes']} {text}".strip()


def read_pdl_il_colpo(pdl_path, scaletta_path=None):
    """Same shape as read_pdl.read_pdl: {cast, days, scenes}. Each day may also have "second_unit":
    {unit: '2nd', name, call, wrap, scenes} and "notes" (the centred lines). This layout has no cast index
    and no scaletta (scaletta_path is ignored)."""
    return read_il_colpo_lines(page_lines(pdl_path))


def read_il_colpo_lines(lines):
    """The schedule from the lines with their positions: [(x, size, text)] (tests give them directly)."""
    days, day, scene, target = [], None, None, None

    def close_scene():
        nonlocal scene
        if scene and target is not None:
            target.append(scene)
        scene = None

    for x, size, text in lines:
        header = DAY_RE.match(text)
        if header:
            close_scene()
            number, times, dd, mm, yyyy = header.groups()
            call, wrap = hours(times)
            day = {"day": int(number), "date": f"{yyyy}-{mm}-{dd}", "week": None, "call": call, "wrap": wrap,
                   "scenes": [], "notes": []}
            days.append(day)
            target = day["scenes"]
            continue
        if DAY_OFF_RE.match(text):
            close_scene()
            day, target = None, None
            continue
        if day is None:
            continue  # the title page lines, or a day off
        unit = UNIT_RE.match(text) if x >= CENTRED_FROM else None
        if unit:
            close_scene()
            name, _, times = unit.group(1).partition(":")
            call, wrap = hours(times)
            day["second_unit"] = {"unit": "2nd", "name": name.strip().title(), "call": call, "wrap": wrap, "scenes": []}
            target = day["second_unit"]["scenes"]
            continue
        if x >= CENTRED_FROM and x < CAST_X - 3 and not scene:
            day["notes"].append(text)  # a note between the header and the first scene
            continue
        if column(x) == "scene" and SCENE_RE.match(text) and size > 9:
            close_scene()
            scene = new_scene(text)
            continue
        if scene:
            add_line(scene, x, size, text)
    close_scene()

    scenes = {}
    for day in days:
        for one in day["scenes"] + day.get("second_unit", {}).get("scenes", []):
            scenes.setdefault(one["scene_id"], one)
    return {"cast": {}, "days": days, "scenes": scenes}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    result = read_pdl_il_colpo(sys.argv[1])
    for day in result["days"]:
        print(f"Day {day['day']} {day['date']} {day['call']}–{day['wrap']}: "
              f"{' · '.join(s['scene_id'] for s in day['scenes'])}")
        for note in day["notes"]:
            print(f"    note: {note}")
        second = day.get("second_unit")
        if second:
            print(f"    2nd unit · {second['name']} · {second['call'] or '?'}–{second['wrap'] or '?'}: "
                  f"{' · '.join(s['scene_id'] for s in second['scenes'])}")
    print(f"\n{len(result['days'])} days · {len(result['scenes'])} scenes")
    if len(sys.argv) > 2 and sys.argv[2] == "--json":
        print(json.dumps(result, ensure_ascii=False, indent=1)[:4000])
