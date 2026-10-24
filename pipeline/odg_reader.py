"""odg_reader.py — picks the call-sheet (ODG) reader a film uses, from that film's settings.json:
    "odg_reader": "tramp"     → read_odg_tramp.py (Tramp Limited layout: Il colpo)
    nothing                   → read_odg.py, the main reader (LBE, Memo Films layout)
Each film chooses its own; the main reader is never changed for another film (Ana, 24 Oct).
Both readers give the same data, so the robot (run.py, propose.py) works the same for every film.
Used by: propose.py, run.py
"""

import json
from pathlib import Path

from read_odg import read_odg
from read_odg_tramp import read_odg_tramp

READERS = {"main": read_odg, "tramp": read_odg_tramp}


def odg_reader_for(film_folder):
    """The film's ODG reader (a function: PDF path → data). Unknown name → stop with a clear message."""
    settings_file = Path(film_folder) / "settings.json"
    settings = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file.exists() else {}
    name = settings.get("odg_reader", "main")
    if name not in READERS:
        raise ValueError(f'settings.json "odg_reader": "{name}" is not one of {", ".join(READERS)}')
    return READERS[name]
