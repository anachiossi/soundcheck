"""test_read_location.py — where the alarms robot drives to, from an ODG's header (pipeline/read_location.py).
Addresses are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from read_location import PREFERENCE_MEZZI, where_to_drive  # noqa: E402

LUX_VIDE = ["SET: CASA ROSSI – Via Uno 1, Roma – https://maps.app.goo.gl/set1",
            "CAMPO BASE: Via Due 2, Roma – https://maps.app.goo.gl/base2",
            "MEZZI TECNICI: Via Tre 3, Roma – https://maps.app.goo.gl/mezzi3"]


class WhereToDriveTest(unittest.TestCase):
    def test_a_film_riding_the_camera_truck_drives_to_the_mezzi_tecnici(self):
        place = where_to_drive(LUX_VIDE, PREFERENCE_MEZZI)
        self.assertEqual((place["label"], place["link"]), ("MEZZI TECNICI", "https://maps.app.goo.gl/mezzi3"))

    def test_base_camp_and_trucks_on_one_line_count_as_the_trucks(self):
        place = where_to_drive(["CAMPO BASE/MEZZI TECNICI: Via Quattro 4 – https://maps.app.goo.gl/q4"], PREFERENCE_MEZZI)
        self.assertEqual(place["link"], "https://maps.app.goo.gl/q4")

    def test_no_trucks_on_the_odg_then_the_set(self):
        self.assertEqual(where_to_drive(LUX_VIDE[:2], PREFERENCE_MEZZI)["link"], "https://maps.app.goo.gl/set1")

    def test_other_films_keep_the_crew_parking_then_the_set(self):
        lines = ["LOCATION: Via Cinque 5 - https://maps.app.goo.gl/l5", "MEZZI TECNICI: Via Sei 6",
                 "PARCHEGGIO TROUPE: Via Sette 7 - https://maps.app.goo.gl/p7"]
        self.assertEqual(where_to_drive(lines)["link"], "https://maps.app.goo.gl/p7")
        self.assertEqual(where_to_drive(lines[:2])["link"], "https://maps.app.goo.gl/l5", "the set before the trucks")


if __name__ == "__main__":
    unittest.main()
