"""read_lines.py — reads WHO SAYS WHAT in each scene of a screenplay PDF (the day's sides
or the full script), for the app's 🎙 Cues mode.

Layout (LBE script, A4): scene number far left (x ≈ 54) beside the heading (x ≈ 108);
speaker name (x ≈ 240–260); dialogue (x ≈ 180); stage directions in brackets (x ≈ 205–220,
left out: Cues shows only the words); action (x ≈ 108) ends a speech.
A speech broken by a page turn ("(CONT'D)", "(MORE)") stays one speech.

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
CUE_SUFFIX_RE = re.compile(r"\s*\([^)]*\)\s*$")
NAME_RE = re.compile(r"^[A-ZÀ-Þ][A-ZÀ-Þ'’ .\-]*$")
PAGE_FURNITURE = re.compile(r"^(\d+\.|\(MORE\)|\(CONTINUA\))$", re.I)


def page_lines(path):
    out = []
    for number, page in enumerate(fitz.open(path)):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                if text and not PAGE_FURNITURE.match(text):
                    out.append((number, round(line["bbox"][1]), line["bbox"][0], text))
    return sorted(out)


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


def read_lines(path, wanted=None):
    """{'2': {'heading': 'INT. CASTELLO, CUCINA. GIORNO', 'lines': [{'name': 'INES', 'text': '…'}, …]}}"""
    lines = page_lines(path)
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
        if CUE_X[0] <= x <= CUE_X[1] and NAME_RE.match(CUE_SUFFIX_RE.sub("", text).strip()):
            name = CUE_SUFFIX_RE.sub("", text).strip()
            if speech and speech["name"] == name and CONTINUED_RE.search(text) and speech["open"]:
                continue  # same speech, carried over a page turn
            finish()
            speech = {"name": name, "parts": [], "open": True}
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
