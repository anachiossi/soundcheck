"""read_crew_il_colpo.py — reads the crew table on the back of an Il colpo call sheet (ODG), by POSITION, into the
SAME data as read_crew.py (LBE's layout): [{ department, role, name, call }] in the order printed.
A film uses it when its settings say "odg_reader": "il-colpo" (odg_reader.py → crew_reader_for).

What this layout prints (ODG #55, page 2): four column groups side by side, each role · name · call:
    x ≈ 21 / 78 / 140      x ≈ 163 / 219 / 289      x ≈ 310 / 361 / 427      x ≈ 447 / 503 / 561
    REGIA          SET     FOTOGRAFIA          SET  COSTUMI             C.B.  AUTISTI             PRON.
    Regista  Vincenzo Alfieri 16:00   Operatore Mdp A  Alessandro Gentili 16:00 …
A department is its name in capitals + where it gathers (SET · C.B. · UFF. · PRON.) as its "call".
The call is a time (16:00) or a code, kept as printed: O/C, PNR, LT, M (Fabio Sabatini: malattia), "-".
A name like "(3)" (Manovali Scenografia) is a count, not a person: skipped.
Reading the text top to bottom would mix the four departments of a row: so every cell goes to its column.

    python pipeline/read_crew_il_colpo.py "path/to/IC - OdgDAY_55.pdf"
"""

import json
import re
import sys

GROUP_EDGES = (155, 300, 440)   # the left edge of the 2nd, 3rd and 4th column group (the page is 595 wide)
PLACES = {"SET", "C.B.", "UFF.", "PRON.", "CB", "UFF"}
DAILY_DEPARTMENTS = {"PERSONALE AGGIUNTO"}  # people hired for that day only (same as read_crew.py)


def group_of(x):
    return sum(x >= edge for edge in GROUP_EDGES)


def crew_from_cells(cells):
    """cells = [(x, y, text)] of the crew page → [{department, role, name, call}]"""
    header = next((y for x, y, text in cells if text == "REGIA"
                   and any(t in PLACES and abs(yy - y) < 2 for xx, yy, t in cells)), None)
    if header is None:
        return []
    # the crew table ends where the next day's programme starts lower on the page ("Programma del giorno
    # successivo…", then its scene table "SCENA LUCE…"): those rows are scenes, not people
    end = min([y for x, y, text in cells if y > header and (text.startswith("Programma del giorno") or text == "SCENA")],
              default=10_000)
    rows = {}
    for x, y, text in cells:
        if y < header - 2 or y >= end - 1:
            continue
        rows.setdefault((group_of(x), round(y)), []).append((x, text))
    crew, department = [], {}
    for (group, y) in sorted(rows, key=lambda key: (key[0], key[1])):
        row = [text for x, text in sorted(rows[(group, y)])]
        if len(row) == 2 and row[1] in PLACES and row[0].isupper():
            department[group] = row[0]
            continue
        if len(row) != 3:
            continue
        role, name, call = row
        if re.fullmatch(r"\(\d+\)|-", name):
            continue
        crew.append({"department": department.get(group, ""), "role": role, "name": name, "call": call,
                     "group": group, "y": y})
    crew.sort(key=lambda person: (person["y"], person["group"]))  # the order printed, row by row
    return [{k: v for k, v in person.items() if k not in ("group", "y")} for person in crew]


def read_crew_il_colpo(path):
    import pymupdf as fitz
    for page in fitz.open(path):
        cells = [(line["bbox"][0], line["bbox"][1], "".join(span["text"] for span in line["spans"]).strip())
                 for block in page.get_text("dict")["blocks"] for line in block.get("lines", [])]
        crew = crew_from_cells([cell for cell in cells if cell[2]])
        if crew:
            return crew
    return []


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    people = read_crew_il_colpo(sys.argv[1])
    for person in people:
        print(f"{person['department']:<20} {person['role']:<28} {person['name']:<30} {person['call']}")
    print(f"{len(people)} people")
