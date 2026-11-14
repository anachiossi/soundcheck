"""odg_reader.py — picks the call-sheet (ODG) reader a film uses, from that film's settings.json:
    "odg_reader": "il-colpo"  → read_odg_il_colpo.py (Il colpo's layout; any later film with the same layout can use it)
    "odg_reader": "lux-vide"  → read_odg_lux_vide.py (Lux Vide's layout: Confine, Nov 2026)
    nothing                   → read_odg.py, the main reader (LBE, Memo Films layout)
Each film chooses its own; the main reader is never changed for another film (Ana, 24 Oct).
Both readers give the same data, so the robot (run.py, propose.py) works the same for every film.
crew_reader_for: the reader of the crew table on the back of the ODG, chosen the same way.
Used by: propose.py, run.py
"""

import json
from functools import partial
from pathlib import Path

from read_odg import read_odg
from read_odg_il_colpo import read_odg_il_colpo
from read_odg_lux_vide import read_odg_lux_vide

READERS = {"main": read_odg, "il-colpo": read_odg_il_colpo, "lux-vide": read_odg_lux_vide}


def odg_reader_for(film_folder):
    """The film's ODG reader (a function: PDF path → data). Unknown name → stop with a clear message."""
    settings_file = Path(film_folder) / "settings.json"
    settings = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file.exists() else {}
    name = settings.get("odg_reader", "main")
    if name == "table":  # the reader driven by a template of words (read_odg_table.py, odg_template.py)
        from odg_template import template_for
        from read_odg_table import read_odg_table
        return partial(read_odg_table, template=template_for(settings), main_unit=settings.get("main_unit"))
    if name not in READERS:
        raise ValueError(f'settings.json "odg_reader": "{name}" is not one of {", ".join(READERS)}')
    if name == "il-colpo":  # this layout prints two units on one day: the film says which is the main one
        return partial(read_odg_il_colpo, main_unit=settings.get("main_unit"))
    return READERS[name]


def crew_reader_for(film_folder):
    """The reader of the crew table on the back of the film's ODGs (same choice as odg_reader_for):
    Il colpo's layout → read_crew_il_colpo.py (four column groups, by position), Lux Vide's → read_crew_lux_vide.py
    (three), else read_crew.py (LBE)."""
    from read_crew import read_crew
    from read_crew_il_colpo import read_crew_il_colpo
    from read_crew_lux_vide import read_crew_lux_vide
    settings_file = Path(film_folder) / "settings.json"
    settings = json.loads(settings_file.read_text(encoding="utf-8")) if settings_file.exists() else {}
    return {"il-colpo": read_crew_il_colpo, "lux-vide": read_crew_lux_vide}.get(settings.get("odg_reader"), read_crew)
