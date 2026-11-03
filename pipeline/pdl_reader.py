"""pdl_reader.py — picks the shooting-schedule (PDL) reader a film uses, from that film's settings.json:
    "pdl_reader": "il-colpo"  → read_pdl_il_colpo.py (Il colpo's layout, with the 2nd unit)
    nothing                   → read_pdl.py, the main reader (LBE layout, with its scaletta)
Like odg_reader.py: each film chooses its own; the main reader is never changed for another film.
Both readers give the same data, so propose_pdl.py works the same for every film.
Used by: propose_pdl.py
"""

import json
from pathlib import Path

from read_pdl import read_pdl
from read_pdl_il_colpo import read_pdl_il_colpo

READERS = {"main": read_pdl, "il-colpo": read_pdl_il_colpo}


def pdl_reader_for(film_folder):
    """The film's PDL reader (a function: PDL path, scaletta path → data). Unknown name → stop with a clear message."""
    settings_file = Path(film_folder) / "settings.json"
    settings = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file.exists() else {}
    name = settings.get("pdl_reader", "main")
    if name not in READERS:
        raise ValueError(f'settings.json "pdl_reader": "{name}" is not one of {", ".join(READERS)}')
    return READERS[name]
