"""read_sides.py — reads the day's sides (STRALCI: the script pages of the day's scenes)
and finds WHO SPEAKS in each scene.

Screenplay layout (LBE script, A4): the scene number sits on the far left (x ≈ 54) next to
the heading "INT. CASTELLO, CUCINA. GIORNO" (x ≈ 108); speaker names ("cues") are in
capitals in their own column (x ≈ 240–260), dialogue under them (x ≈ 180).
Pages often start or end with a piece of another day's scene: only the scene numbers
asked for are kept.

    python pipeline/read_sides.py "path/to/LBE - STRALCI DAY #6.pdf" 2
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

SCENE_X = (40, 70)      # scene number column
HEADING_X = (100, 120)  # INT./EST. heading column
CUE_X = (235, 275)      # speaker names
HEADING_RE = re.compile(r"^(INT|EST|EXT|I/E|INT/EST)[.\s]", re.I)
SCENE_ID_RE = re.compile(r"^\d+[A-Za-z]{0,3}$")
CUE_SUFFIX_RE = re.compile(r"\s*\((CONT.{0,3}D|V\.?O\.?|O\.?S\.?|F\.?C\.?|OFF|O\.?C\.?)\.?\)\s*$", re.I)
NAME_RE = re.compile(r"^[A-ZÀ-Þ][A-ZÀ-Þ'’ .\-]*$")
NOT_SPEAKERS = {"FINE", "STACCO", "DISSOLVENZA", "CONTINUA", "INTERCUT"}


def page_lines(path):
    """(page, y, x, text) for every text line, top to bottom."""
    out = []
    for number, page in enumerate(fitz.open(path)):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text:
                    out.append((number, round(line["bbox"][1]), line["bbox"][0], text))
    return sorted(out)


def read_sides(path, wanted_scenes=None):
    """{'2': {'speakers': ['INES', 'PRINCE JOHN', …], 'heading': 'INT. CASTELLO, CUCINA. GIORNO'}}"""
    lines = page_lines(path)
    scenes, current = {}, None
    for i, (page, y, x, text) in enumerate(lines):
        # A scene starts where a number (left) and an INT./EST. heading share the same line.
        if SCENE_X[0] <= x <= SCENE_X[1] and SCENE_ID_RE.match(text):
            heading = next((t for p, yy, xx, t in lines
                            if p == page and abs(yy - y) <= 2 and HEADING_X[0] <= xx <= HEADING_X[1]
                            and HEADING_RE.match(t)), None)
            if heading:
                current = text
                scenes.setdefault(current, {"heading": re.sub(r"\s+", " ", heading), "speakers": []})
                continue
        if current and CUE_X[0] <= x <= CUE_X[1]:
            name = CUE_SUFFIX_RE.sub("", text).strip()
            if NAME_RE.match(name) and name not in NOT_SPEAKERS and len(name) <= 30:
                if name not in scenes[current]["speakers"]:
                    scenes[current]["speakers"].append(name)
    if wanted_scenes:
        scenes = {sid: data for sid, data in scenes.items() if sid in wanted_scenes}
    return scenes


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_sides(sys.argv[1], sys.argv[2:] or None), ensure_ascii=False, indent=1))
