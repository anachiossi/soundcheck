"""read_crew_lux_vide.py — reads the crew table on page 2 of a Lux Vide call sheet (Confine), by POSITION, into the
SAME data as read_crew.py (LBE's layout): [{ department, role, name, call }] in the order printed.
A film uses it when its settings say "odg_reader": "lux-vide" (odg_reader.py → crew_reader_for).

What this layout prints (ODG #26, 5 Nov 2026): three column groups side by side, each "Role: Name" · call:
    x ≈ 34 / 182        x ≈ 212 / 364        x ≈ 394 / 542
    REGISTA     CALL    SCENOGRAFIA   CALL   ELETTRICISTI    CALL
    Regista: Michele Soavi 08:00   Scenografo: Stefano Pica O/C   …
A department is a line in capitals with "CALL" beside it. The call is a time (08:00) or a code kept as printed
(O/C, TL, "-"). AGGIUNTI = people hired for the day (Ana is one). The table ends at the next day's programme.

    python pipeline/read_crew_lux_vide.py "path/to/CNF_ODG_#26.pdf"
"""

import json
import re
import sys

from read_odg_lux_vide import lines_of

GROUP_EDGES = (205, 390)   # the left edge of the 2nd and 3rd column group (the page is 595 wide)
CALL_X = (170, 360, 530)   # a group's call column starts here


def group_of(x):
    return sum(x >= edge for edge in GROUP_EDGES)


def read_crew_lines(lines):
    """lines = [(y, x, text)] of the crew page → [{department, role, name, call}]."""
    end = next((y for y, x, text in lines if text.upper().startswith("PROGRAMMA DEL GIORNO SUCCESSIVO")), 10_000)
    rows = {}
    for y, x, text in lines:
        if y < end:
            rows.setdefault(y, []).append((x, text))
    department, people = {}, {0: [], 1: [], 2: []}
    for y in sorted(rows):
        cells = {}
        for x, text in rows[y]:
            group = group_of(x)
            kind = "call" if x >= CALL_X[group] else "text"
            cells.setdefault(group, {})[kind] = text
        for group, cell in sorted(cells.items()):
            text, call = cell.get("text", ""), cell.get("call", "")
            if call.upper() == "CALL" and text and text == text.upper():
                department[group] = text
            elif ":" in text and department.get(group):
                role, name = (part.strip() for part in text.split(":", 1))
                if name:
                    people[group].append({"department": department[group], "role": role, "name": name,
                                          "call": call.replace(".", ":") if re.fullmatch(r"\d{1,2}[.:]\d{2}", call) else call})
    return people[0] + people[1] + people[2]


def read_crew_lux_vide(path):
    import pymupdf as fitz
    for page in fitz.open(path):
        crew = read_crew_lines(lines_of(page))
        if len(crew) > 5:
            return crew
    return []


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_crew_lux_vide(sys.argv[1]), ensure_ascii=False, indent=1))
