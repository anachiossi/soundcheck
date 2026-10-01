"""read_lines.py — reads WHO SAYS WHAT in each scene of a screenplay PDF (the day's sides
or the full script), for the app's 🎙 Cues mode.

Layout (LBE script, A4): scene number far left (x ≈ 54) beside the heading (x ≈ 108);
speaker name (x ≈ 240–260); dialogue (x ≈ 180); stage directions in brackets (x ≈ 205–220,
left out: Cues shows only the words); action (x ≈ 108) ends a speech.
A speech broken by a page turn ("(CONT'D)", "(MORE)") stays one speech.
Options, OFF unless the film's settings.json turns them on (so one film never changes another):
    "script_reader": { "watermarks": true, "unnumbered_scenes": true }
  • watermarks — text in the same place on most pages (e.g. "Ana Som" on every page of a copy sent
    to one person) is page decoration, never dialogue
  • unnumbered_scenes — a scene heading with no number is a new scene: after 30 → 30A, 30B…
  (both learnt on Vigília, Oct 2026; LBE has neither)

    python pipeline/read_lines.py "path/to/script.pdf" [scene ids…]
"""

import json
import re
import sys

import pymupdf as fitz  # the PDF reader (PyMuPDF)

SCENE_X, HEADING_X, CUE_X = (40, 70), (100, 120), (235, 275)
DIALOGUE_X, DIRECTION_X = (170, 195), (200, 225)
HEADING_RE = re.compile(r"^(INT|EST|EXT|I/E|INT/EST)[.\s]", re.I)
SCENE_ID_RE = re.compile(r"^\d+[A-Za-z]{0,3}$")
CONTINUED_RE = re.compile(r"\((CONT.{0,3}D|SEGUE|CONTINUA)\)", re.I)
CUE_SUFFIX_RE = re.compile(r"(\s*\([^)]*\))+\s*$")  # "PINA(CONT'D)  (CONT'D)": every bracket at the end
NAME_RE = re.compile(r"^[A-ZÀ-Þ][A-ZÀ-Þ'’ .\-]*$")
PAGE_FURNITURE = re.compile(r"^(\d+\.|\(MORE\)|\(CONTINUA\))$", re.I)


def page_lines(path, options=None):
    out = []
    for number, page in enumerate(fitz.open(path)):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text and not PAGE_FURNITURE.match(text):
                    out.append((number, round(line["bbox"][1]), line["bbox"][0], text))
    return sorted(without_watermarks(out) if (options or {}).get("watermarks") else out)


def without_watermarks(lines):
    """Leave out text found in the same place (±3 pt) on at least 3 pages and on most of them."""
    pages = len({page for page, *_ in lines})
    where = {}
    for page, y, x, text in lines:
        where.setdefault((text, round(y / 3), round(x / 3)), set()).add(page)
    marks = {key for key, seen in where.items() if len(seen) >= 3 and len(seen) >= pages * 0.6}
    return [line for line in lines if (line[3], round(line[1] / 3), round(line[2] / 3)) not in marks]


def next_letter(scene_id, taken):
    """The id for a heading with no number: '30' → '30A' (or '30B' if 30A exists…)."""
    base = re.match(r"\d+", scene_id).group()
    return next(base + letter for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if base + letter not in taken)


def join_text(parts):
    """Lines of one speech → one text; 'pre-' + 'montato' → 'pre-montato'; a stage direction → new line."""
    text = ""
    for part in parts:
        if part == "\n":
            text = text.rstrip() + "\n"
        elif text.endswith("-") and part[:1].islower():
            text += part
        else:
            text += ("" if not text or text.endswith("\n") else " ") + part
    return text.strip()


def read_lines(path, wanted=None, options=None):
    """{'2': {'heading': 'INT. CASTELLO, CUCINA. GIORNO', 'lines': [{'name': 'INES', 'text': '…'}, …]}}"""
    lines = page_lines(path, options)
    unnumbered = (options or {}).get("unnumbered_scenes")
    scenes, current, speech = {}, None, None

    def finish():
        nonlocal speech
        if speech and speech["parts"]:
            text = join_text(speech["parts"])
            if text:
                scenes[current]["lines"].append({"name": speech["name"], "text": text})
        speech = None

    for page, y, x, text in lines:
        if SCENE_X[0] <= x <= SCENE_X[1] and SCENE_ID_RE.match(text):
            heading = next((t for p, yy, xx, t in lines if p == page and abs(yy - y) <= 2
                            and HEADING_X[0] <= xx <= HEADING_X[1] and HEADING_RE.match(t)), None)
            if heading:
                finish()
                current = text
                scenes.setdefault(current, {"heading": re.sub(r"\s+", " ", heading), "lines": []})
                continue
        if current is None:
            continue
        if unnumbered and HEADING_X[0] <= x <= HEADING_X[1] and HEADING_RE.match(text) and not any(
                p == page and abs(yy - y) <= 2 and SCENE_X[0] <= xx <= SCENE_X[1] and SCENE_ID_RE.match(t)
                for p, yy, xx, t in lines):
            finish()  # a heading without a number: a new scene all the same
            current = next_letter(current, scenes)
            scenes[current] = {"heading": re.sub(r"\s+", " ", text), "lines": []}
            continue
        if CUE_X[0] <= x <= CUE_X[1] and NAME_RE.match(CUE_SUFFIX_RE.sub("", text).strip()):
            name = CUE_SUFFIX_RE.sub("", text).strip()
            if speech and speech["name"] == name and CONTINUED_RE.search(text) and speech["open"]:
                continue  # same speech, carried over a page turn
            finish()
            speech = {"name": name, "parts": [], "open": True}
        elif speech and DIALOGUE_X[0] <= x <= DIALOGUE_X[1] and re.fullmatch(r"\(.*\)", text):
            if speech["parts"] and speech["parts"][-1] != "\n":
                speech["parts"].append("\n")  # a stage direction in brackets, on the dialogue's margin
        elif speech and DIALOGUE_X[0] <= x <= DIALOGUE_X[1]:
            speech["parts"].append(text)
        elif speech and DIRECTION_X[0] <= x <= DIRECTION_X[1]:
            if speech["parts"] and speech["parts"][-1] != "\n":
                speech["parts"].append("\n")  # the words go on after a stage direction
        elif HEADING_X[0] <= x <= HEADING_X[1] and not HEADING_RE.match(text):
            finish()  # action ends the speech
    finish()
    if wanted:
        scenes = {sid: scene for sid, scene in scenes.items() if sid in wanted}
    return scenes


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_lines(sys.argv[1], sys.argv[2:] or None), ensure_ascii=False, indent=1))
