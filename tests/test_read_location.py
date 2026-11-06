"""test_read_location.py — the places an ODG prints and where the alarms drive to (pipeline/read_location.py).
Addresses are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from read_location import chosen_place, places_of  # noqa: E402

LUX_VIDE = ["SET: CASA ROSSI – Via Uno 1, Roma – https://maps.app.goo.gl/set1",
            "CAMPO BASE: Via Due 2, Roma – https://maps.app.goo.gl/base2",
            "MEZZI TECNICI: Via Tre 3, Roma – https://maps.app.goo.gl/mezzi3"]


class PlacesTest(unittest.TestCase):
    def test_every_place_the_odg_prints_is_kept_in_its_order(self):
        self.assertEqual([(p["kind"], p["label"], p["link"]) for p in places_of(LUX_VIDE)],
                         [("set", "SET", "https://maps.app.goo.gl/set1"), ("campo", "CAMPO BASE", "https://maps.app.goo.gl/base2"),
                          ("mezzi", "MEZZI TECNICI", "https://maps.app.goo.gl/mezzi3")])

    def test_a_film_riding_the_camera_truck_drives_to_the_mezzi_tecnici(self):
        self.assertEqual(chosen_place(places_of(LUX_VIDE), "mezzi")["link"], "https://maps.app.goo.gl/mezzi3")

    def test_base_camp_and_trucks_on_one_line_count_as_the_trucks(self):
        places = places_of(["CAMPO BASE/MEZZI TECNICI: Via Quattro 4 – https://maps.app.goo.gl/q4"])
        self.assertEqual((places[0]["kind"], chosen_place(places, "mezzi")["link"]), ("mezzi", "https://maps.app.goo.gl/q4"))

    def test_the_films_choice_not_printed_that_day_then_the_set(self):
        self.assertEqual(chosen_place(places_of(LUX_VIDE[:2]), "mezzi")["link"], "https://maps.app.goo.gl/set1")

    def test_with_no_choice_the_crew_parking_then_the_set(self):
        lines = ["LOCATION: Via Cinque 5 - https://maps.app.goo.gl/l5", "MEZZI TECNICI: Via Sei 6",
                 "PARCHEGGIO TROUPE: Via Sette 7 - https://maps.app.goo.gl/p7"]
        self.assertEqual(chosen_place(places_of(lines))["link"], "https://maps.app.goo.gl/p7")
        self.assertEqual(chosen_place(places_of(lines[:2]))["link"], "https://maps.app.goo.gl/l5", "the set before the trucks")


if __name__ == "__main__":
    unittest.main()
