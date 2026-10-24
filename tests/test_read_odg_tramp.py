"""test_read_odg_tramp.py — the ODG reader for the Tramp Limited layout (pipeline/read_odg_tramp.py), with the
lines laid out as those PDFs print them. Names, scenes and notes are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

try:
    from odg_reader import odg_reader_for
    from read_odg import read_odg
    from read_odg_tramp import read_odg_tramp, read_tramp
except ImportError:  # pymupdf not installed here
    read_tramp = None

HEADER = ["ODG #20 di 60 Sabato 24 Ottobre 2026 Settimana #4", "CONVOCAZIONE", "09:00", "PROVE", "09:15",
          "PRONTI A GIRARE DRONE", "09:15", "FINE RIPRESE", "16:30", "FINE LAVORAZIONE", "17:00"]
TABLE = ["SCENA", "LUCE", "SET/SINOSSI", "DAY", "CAST", "PGS.", "TIMELINE",
         "12", "E", "G", "SCUOLA", "The front of the school.", "3", "-", "1/8", "09:15", "09:45",
         "13pt1", "I", "G", "SCUOLA/Corridoi", "A father shows his son the school,", "and the boy runs off.",
         "3", "8, 19", "1 6/8", "09:45", "12:00",
         "TOT PGS.", "1 7/8"]
CAST = ["CAST", "ID", "RUOLO", "NOME", "SCENE", "SET",
        "8", "PADRE", "Actor One", "13pt1", "07:20", "08:20",
        "19", "FIGLIO (M)", "Actor Two", "13pt1", "09:40", "-",
        "CONVOCAZIONE FIGURAZIONI SPECIALI TOT. 1", "ID.", "RUOLO", "SET",
        "ID.90", "BIDELLA (Actor Three)", "12 - 13pt", "08:10",
        "CONVOCAZIONE MINORI TOT. 2"]
NEEDS = ["FABBISOGNI", "PROPS",
         "13pt1: Toy monster 12 - 13pt1: School bags, Phones,", "Newspapers",
         "ATTREZZATURE SPECIALI", "12: DRONE sul set ore 08:30",
         "PRODUZIONE", "Blockers sul set ore 9:00",
         "Direttore di Produzione: Someone"]
ADVANCE = ["Programma del giorno successivo Lunedì 26 ottobre 2026 orario di lavorazione 10:00 - 18:00",
           "SCENA", "LUCE", "SET/SINOSSI", "DAY", "CAST", "PGS.", "TIMELINE",
           "40", "E", "T", "CIMITERO", "A family in mourning.", "1", "1, 2", "4/8",
           "TOT PGS.", "4/8",
           "FABBISOGNI SPECIALI del giorno successivo", "ATTREZZATURE SPECIALI", "HAZE MACHINE",
           "Person Name (Coordinamento) 320 000 0000", "CANALI RADIO:1) regia"]
ODG = HEADER + TABLE + CAST + NEEDS + ADVANCE


@unittest.skipIf(read_tramp is None, "pymupdf not installed")
class TrampLayoutTest(unittest.TestCase):
    def test_a_film_gets_the_main_reader_unless_its_settings_choose_another(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertIs(odg_reader_for(folder), read_odg)  # no settings.json (like LBE: no "odg_reader")
            settings = Path(folder) / "settings.json"
            settings.write_text(json.dumps({"odg_reader": "tramp"}), encoding="utf-8")
            self.assertIs(odg_reader_for(folder), read_odg_tramp)
            settings.write_text(json.dumps({"odg_reader": "nonsense"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                odg_reader_for(folder)

    def test_the_header_gives_day_date_and_times(self):
        odg = read_tramp(ODG)
        self.assertEqual((odg["number"], odg["of_days"], odg["week"]), (20, 60, 4))
        self.assertEqual(odg["date"], "2026-10-24")
        self.assertEqual((odg["call"], odg["ready_to_shoot"], odg["end_of_shoot"], odg["wrap"]),
                         ("09:00", "09:15", "16:30", "17:00"))

    def test_each_scene_has_its_set_wrapped_synopsis_cast_pages_and_timeline(self):
        first, second = read_tramp(ODG)["scenes"]
        self.assertEqual((first["scene_id"], first["int_ext"], first["cast"], first["pages"]), ("12", "EXT", [], "1/8"))
        self.assertEqual((second["scene_id"], second["set"], second["story_day"]), ("13pt1", "SCUOLA/Corridoi", "3"))
        self.assertEqual(second["synopsis"], "A father shows his son the school, and the boy runs off.")
        self.assertEqual((second["cast"], second["pages"]), (["8", "19"], "1 6/8"))
        self.assertEqual((second["start"], second["end"]), ("09:45", "12:00"))

    def test_the_cast_marks_minors_and_special_extras(self):
        cast = {person["id"]: person for person in read_tramp(ODG)["cast"]}
        self.assertEqual(set(cast), {"8", "19", "90"})
        self.assertEqual((cast["19"]["role"], cast["19"].get("minor")), ("FIGLIO", True))
        self.assertEqual((cast["90"]["role"], cast["90"]["actor"], cast["90"]["special_extra"]),
                         ("BIDELLA", "Actor Three", True))

    def test_needs_go_to_their_scenes_and_a_wrapped_line_stays_with_its_scenes(self):
        notes = read_tramp(ODG)["notes"]
        self.assertEqual(notes["13pt1"]["Props"], "Toy monster; School bags, Phones, Newspapers")
        self.assertEqual(notes["12"]["Props"], "School bags, Phones, Newspapers")

    def test_a_time_like_ore_08_30_is_not_read_as_a_scene(self):
        notes = read_tramp(ODG)["notes"]
        self.assertEqual(notes["12"]["Camera"], "DRONE sul set ore 08:30")
        self.assertNotIn("08", notes)

    def test_a_note_with_no_scene_numbers_is_for_every_scene_of_the_day(self):
        notes = read_tramp(ODG)["notes"]
        self.assertEqual(notes["12"]["Produzione"], notes["13pt1"]["Produzione"])

    def test_the_next_day_is_read_from_page_two_without_the_crew_phone_list(self):
        advance = read_tramp(ODG)["advance"]
        self.assertEqual((advance["day"], advance["date"], advance["call"], advance["wrap"]),
                         (21, "2026-10-26", "10:00", "18:00"))
        self.assertEqual([scene["scene_id"] for scene in advance["scenes"]], ["40"])
        self.assertEqual(advance["notes"]["40"]["Camera"], "HAZE MACHINE")


if __name__ == "__main__":
    unittest.main()
