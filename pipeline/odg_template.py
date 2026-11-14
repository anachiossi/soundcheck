"""odg_template.py — the words a call sheet (ODG) uses, as plain data: the "reading template".

read_odg_table.py reads any call sheet whose scenes are printed as a table with a header row. It finds the
columns by the WORDS of that header row (not by fixed positions), so a new production's layout usually needs
no new code: at most a few words added here, or in that film's own settings.json:

    "odg_template": { "columns": { "set": ["AMBIENTE", "LUOGO"] }, "labels": { "call": ["CONVOCAZIONE TROUPE"] } }

A film's words are ADDED to these (template_for), so one film never changes another film's reading.
Used by: read_odg_table.py, odg_reader.py
"""

import re

DEFAULT_TEMPLATE = {
    # the scene table: what each column is called in its header row (capitals, dots and spaces don't matter).
    # One header may name two things ("SET / SINOSSI", "I-E / G-N"): that column holds both.
    "columns": {
        "scene": ["SCENA", "SCENE", "SC"],
        "story_day": ["DAY", "GG", "GIORNO"],
        "int_ext": ["I/E", "I-E", "INT/EXT", "INT-EXT"],
        "light": ["LUCE", "G/N", "G-N", "D/N"],
        "set": ["SET", "AMBIENTE"],
        "synopsis": ["SINOSSI", "DESCRIZIONE"],
        "cast": ["CAST", "ID", "ATTORI"],
        "pages": ["PAG", "PGS", "PAGINE"],
        "location": ["LOCATION"],
        "notes": ["NOTE"],
        "timeline": ["TIMELINE"],
    },
    # the cast table (who plays whom): it is the table whose header has a "role" column
    "cast_columns": {
        "id": ["ID"],
        "role": ["RUOLO", "PERSONAGGIO"],
        "actor": ["ATTORE", "NOME", "CAST", "INTERPRETE"],
        "scenes": ["SCENE"],  # (not kept: named so its cells are not taken for the actor's)
    },
    # the day's times: the label printed before each one
    "labels": {
        "call": ["CONVOCAZIONE"],
        "ready_to_shoot": ["PRONTI A GIRARE"],
        "end_of_shoot": ["FINE RIPRESE"],
        "wrap": ["FINE LAVORAZIONE"],
    },
    # the words that start the NEXT day's programme: the scene tables after them are tomorrow's
    "next_day": ["AVANZAMENTO", "PROGRAMMA DEL GIORNO SUCCESSIVO"],
    # a table row that names a unit ("UNITÀ ALFIERI", "UNIT DE FEUDIS"); the film's "main_unit" says which is main
    "unit": ["UNITÀ", "UNITA'", "UNITA’", "UNITA", "UNIT"],
    # a table row that only says the scenes under it are stand-by, and the row with the day's total pages
    "standby": ["STAND BY", "STAND-BY", "STANDBY"],
    "total": ["TOT"],
}


def template_for(settings):
    """The default words plus the film's own (settings.json "odg_template"), never fewer."""
    own = (settings or {}).get("odg_template") or {}
    template = {}
    for key, default in DEFAULT_TEMPLATE.items():
        extra = own.get(key)
        if isinstance(default, dict):
            template[key] = {name: list(words) + [w for w in (extra or {}).get(name, []) if w not in words]
                             for name, words in default.items()}
        else:
            template[key] = list(default) + [w for w in (extra or []) if w not in default]
    return template


def plain(text):
    """'Pag.' → 'PAG' · 'I-E / G-N' → 'I-E/G-N': how header words are compared."""
    return re.sub(r"[.\s:]", "", str(text or "").upper())


def fields_named(text, columns):
    """The things a header cell names: 'SET / SINOSSI' → ['set', 'synopsis'] · 'Pag.' → ['pages'] · 'Trucco' → []."""
    cell = plain(text)
    found = []
    for field, words in columns.items():
        for word in map(plain, words):
            if cell == word or cell.startswith(word + "/") or cell.endswith("/" + word) or f"/{word}/" in cell:
                found.append((cell.find(word), field))
                break
    return [field for _, field in sorted(found)]
