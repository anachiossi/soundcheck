"""test_read_pdl_il_colpo.py — the PDL reader for Il colpo's layout (pipeline/read_pdl_il_colpo.py), with the
lines placed in their columns as the PDF prints them, and the 2nd unit checks (compare.py → check_day).
Scenes, sets and names are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from compare import check_day  # noqa: E402

try:
    from read_pdl_il_colpo import read_il_colpo_lines
except ImportError:  # pymupdf not installed here
    read_il_colpo_lines = None

BIG, SMALL = 9.9, 8.1  # the scene number is printed bigger than the rest

LINES = [
    (235, 27, "THE FILM"), (203, 13.5, "PDL 01.11"),
    (172, SMALL, "Day #12 - Orario di lavorazione: 15.00/23.00 - Wed 04/11/2026 - 3 1/8"),
    (237, SMALL, "Check if 41 can be DAY"),
    (48, BIG, "40"), (72, SMALL, "Int/Tramonto GYM/RING"), (275, SMALL, "1; 9, 11; 138,"), (275, SMALL, "149"),
    (345, 6.3, "11 Generici: 10x305 - athletes"), (48, SMALL, "2 2/8"),
    (123, SMALL, "Two old friends meet"), (123, SMALL, "again."),
    (48, BIG, "41"), (72, SMALL, "Int/Sera"), (123, SMALL, "GYM/RING"), (275, SMALL, "6; 11"), (48, SMALL, "3/8"),
    (123, SMALL, "Someone trains."),
    (228, SMALL, "UNITA' ROSSI: Orario 8.00/16.00"),
    (48, BIG, "50"), (48, SMALL, "A"), (72, SMALL, "Ext/Giorno"), (123, SMALL, "PETROL STATION/SIDE"),
    (123, SMALL, "ROAD"), (275, SMALL, "3, 4; 18"), (345, 6.3, "47, VFX: 90s cars"), (48, SMALL, "1 1/8"),
    (123, SMALL, "The kids watch."), (123, SMALL, "Veicoli di Scena: KIDS CAR"),
    (241, SMALL, "Day Off - OFF - Sat 07/11/2026"),
    (172, SMALL, "Day #13 - Orario di lavorazione: 17:00/01:00 - Mon 09/11/2026 - 1"),
    (48, BIG, "60"), (72, SMALL, "I+E/Notte"), (123, SMALL, "CAR PARK"), (275, SMALL, "6"), (48, SMALL, "1"),
    (123, SMALL, "They leave."),
    (262, SMALL, "UNITA' ROSSI"),
    (48, BIG, "61"), (72, SMALL, "Ext/Giorno"), (123, SMALL, "VILLA"), (275, SMALL, "2"), (48, SMALL, "2/8"),
    (123, SMALL, "A car arrives."),
]


@unittest.skipIf(read_il_colpo_lines is None, "pymupdf is not installed")
class ReadPdlIlColpoTest(unittest.TestCase):
    def setUp(self):
        self.pdl = read_il_colpo_lines(LINES)
        self.day12, self.day13 = self.pdl["days"]

    def test_each_day_has_its_number_date_and_hours(self):
        self.assertEqual((self.day12["day"], self.day12["date"]), (12, "2026-11-04"))
        self.assertEqual((self.day12["call"], self.day12["wrap"]), ("15:00", "23:00"))
        self.assertEqual((self.day13["call"], self.day13["wrap"]), ("17:00", "01:00"))

    def test_the_main_unit_scenes_stop_where_the_2nd_unit_starts(self):
        self.assertEqual([s["scene_id"] for s in self.day12["scenes"]], ["40", "41"])

    def test_the_2nd_unit_is_called_2nd_and_keeps_the_printed_name(self):
        second = self.day12["second_unit"]
        self.assertEqual(second["unit"], "2nd")
        self.assertEqual(second["name"], "Rossi")
        self.assertEqual((second["call"], second["wrap"]), ("08:00", "16:00"))
        self.assertEqual([s["scene_id"] for s in second["scenes"]], ["50A"])

    def test_a_2nd_unit_with_no_hours_printed_has_none(self):
        second = self.day13["second_unit"]
        self.assertEqual((second["call"], second["wrap"]), ("", ""))
        self.assertEqual([s["scene_id"] for s in second["scenes"]], ["61"])

    def test_a_scene_reads_its_columns(self):
        scene = self.day12["scenes"][0]
        self.assertEqual((scene["int_ext"], scene["time_of_day"], scene["set"]), ("INT", "Tramonto", "GYM/RING"))
        self.assertEqual(scene["cast"], ["1", "9", "11", "138", "149"])
        self.assertEqual(scene["pages"], "2 2/8")
        self.assertEqual(scene["synopsis"], "Two old friends meet again.")

    def test_a_set_that_wraps_and_a_vehicle_note_are_read(self):
        scene = self.day12["second_unit"]["scenes"][0]
        self.assertEqual(scene["set"], "PETROL STATION/SIDE ROAD")
        self.assertEqual(scene["synopsis"], "The kids watch.")
        self.assertIn("Veicoli di Scena: KIDS CAR", scene["notes"])

    def test_inside_and_outside_is_int_ext(self):
        self.assertEqual(self.day13["scenes"][0]["int_ext"], "INT/EXT")

    def test_a_centred_line_before_the_scenes_is_a_note_for_the_day(self):
        self.assertEqual(self.day12["notes"], ["Check if 41 can be DAY"])


SCHEDULE = [
    {"day": 12, "date": "2026-11-04", "week": 2, "call": "15:00", "wrap": "23:00", "scene_id": "40", "order": 1},
    {"day": 12, "date": "2026-11-04", "week": 2, "call": "08:00", "wrap": "16:00", "scene_id": "50A", "order": 1,
     "unit": "2nd", "unit_name": "Rossi"},
]


class CheckSecondUnitTest(unittest.TestCase):
    def test_the_2nd_unit_is_compared_only_with_its_own_rows(self):
        changes, checks = check_day(12, "2026-11-04", "08:00", "16:00", ["50A"], SCHEDULE, "Day 12 · 2nd unit",
                                    2, unit="2nd", unit_name="Rossi")
        self.assertEqual(changes, [])

    def test_a_new_2nd_unit_brings_its_unit_name_and_hours(self):
        changes, _ = check_day(13, "2026-11-09", "", "", ["61"], SCHEDULE, "Day 13 · 2nd unit",
                               2, unit="2nd", unit_name="Rossi")
        op = changes[0]["op"]
        self.assertEqual((op["op"], op["unit"]), ("set_day_scenes", "2nd"))
        self.assertEqual(op["fields"]["unit_name"], "Rossi")
        self.assertNotIn("call", op["fields"], "no hours printed: no hours guessed")

    def test_the_main_unit_ignores_the_2nd_unit_rows(self):
        changes, _ = check_day(12, "2026-11-04", "15:00", "23:00", ["40"], SCHEDULE, "Day 12")
        self.assertEqual(changes, [])


if __name__ == "__main__":
    unittest.main()
