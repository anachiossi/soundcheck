"""read_crew.py — reads the crew list ("TROUPE") printed on the back of a call sheet (ODG).

The table has three column groups side by side, each: role · name · call time.
A department starts with its name in capitals where a role would be (REGIA, PRODUZIONE,
SUONO, … PERSONALE AGGIUNTO = extra people hired for the day) and "SET" as its time.
A role printed with no name is an empty place that day: skipped.
Returns [{ department, role, name, call }] in the order printed.

    python pipeline/read_crew.py "path/to/LBE - ODG#6.pdf"
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

DAILY_DEPARTMENTS = {"PERSONALE AGGIUNTO"}  # people hired for that day only


def page_cells(page):
    cells = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                cells.append((line["bbox"][1], line["bbox"][0], text))
    return cells


def read_crew(path):
    for page in fitz.open(path):
        cells = page_cells(page)
        top = next((y for y, x, t in cells if t == "TROUPE"), None)
        if top is None:
            continue
        # The table ends where the next table starts (the scene list / department needs).
        bottom = min([y for y, x, t in cells if y > top and t in ("Scena", "FABBISOGNI REPARTI")] or [10_000])
        cells = sorted(c for c in cells if top + 4 < c[0] < bottom)
        # First row = three department names (where each group's role column starts),
        # each with "SET" printed where that group's time column is.
        first_y = cells[0][0]
        header = sorted((x, t) for y, x, t in cells if abs(y - first_y) < 3)
        role_x = [x for x, t in header if t != "SET"][:3]
        time_x = [x for x, t in header if t == "SET"][:3]
        if len(role_x) < 3 or len(time_x) < 3:
            continue
        group_of = lambda x: max((g for g in range(3) if x >= role_x[g] - 5), default=None)

        rows = {}
        for y, x, text in cells:
            group = group_of(x)
            if group is not None:
                rows.setdefault(round(y / 4), {}).setdefault(group, []).append((x, text))

        people, department = {0: [], 1: [], 2: []}, {0: "", 1: "", 2: ""}
        for key in sorted(rows):
            for group, parts in rows[key].items():
                parts.sort()
                start, time_start = role_x[group], time_x[group]
                role = " ".join(t for x, t in parts if x < start + 10)
                name = " ".join(t for x, t in parts if start + 10 <= x < time_start - 8)
                call = " ".join(t for x, t in parts if x >= time_start - 8)
                if call == "SET" and not name:  # a department header
                    department[group] = clean(role)
                elif name and role:
                    people[group].append({"department": department[group], "role": clean(role),
                                          "name": clean(name), "call": call.strip()})
        return people[0] + people[1] + people[2]
    return []


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    crew = read_crew(sys.argv[1])
    for person in crew:
        print(f"{person['department']:<22} {person['role']:<32} {person['name']:<26} {person['call']}")
    print(len(crew), "people")
