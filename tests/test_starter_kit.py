"""test_starter_kit.py — the kit and the IFB list every film starts with (pipeline/starter_kit.py), and the crew's
usual tag colours (pipeline/crew_colors.py). Names are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from crew_colors import color_for  # noqa: E402
from starter_kit import format_json, minimum_ifb, starter_files  # noqa: E402

CREW = [{"id": "1", "name": "Mixer Person", "job": "Fonico"},
        {"id": "2", "name": "Some Director", "job": "Regista"},
        {"id": "3", "name": "First Ad", "job": "Aiuto Regista"},
        {"id": "4", "name": "Second Ad", "job": "Secondo Aiuto Regista"},
        {"id": "5", "name": "Script Person", "job": "Segretaria di Ediz."},
        {"id": "6", "name": "Focus A", "job": "Ass. Operatore"},
        {"id": "7", "name": "Focus B", "job": "Ass. Operatore"},
        {"id": "8", "name": "Video Person", "job": "Video Assist"}]


class StarterKitTest(unittest.TestCase):
    def test_every_film_starts_with_numbered_tx_lavs_receivers_and_headphones(self):
        files = starter_files()
        for path in ("transmitters.json", "lavaliers.json", "ifb/receivers.json", "ifb/headphones.json"):
            self.assertEqual([piece["id"] for piece in files[path]][:3], ["1", "2", "3"], path)
            self.assertEqual(files[path][0]["model"], "", "numbers only: the real model comes later")

    def test_the_ifb_list_starts_with_the_people_who_always_need_one_and_three_vips(self):
        vips, rows, missing = minimum_ifb(CREW)
        self.assertEqual(missing, [])
        self.assertEqual([row["crew_id"] for row in rows], ["2", "8", "3", "4", "5", "6", "7", "9", "10", "11"])
        self.assertEqual([vip["name"] for vip in vips], ["VIP 1", "VIP 2", "VIP 3"])
        self.assertEqual((rows[0]["rx_id"], rows[0]["hp_id"]), ("1", "1"))

    def test_a_job_nobody_has_is_said(self):
        _, _, missing = minimum_ifb([person for person in CREW if person["job"] != "Video Assist"])
        self.assertEqual(missing, ["Video assist"])

    def test_the_files_are_written_like_the_app_writes_them(self):
        self.assertEqual(format_json([{"id": "1", "model": ""}]), '[\n  { "id": "1", "model": "" }\n]\n')

    def test_crew_tags_get_the_usual_colour_of_their_job(self):
        self.assertEqual(color_for("Fonico"), "#ae72d4")
        self.assertEqual(color_for("Regista"), "#4561ff")
        self.assertEqual(color_for("Ass. Operatore"), "#59d16c")
        self.assertEqual(color_for("II° Aiuto Regia"), "#6fd0e3")
        self.assertEqual(color_for("Autista MDP"), "#e8e4e1", "a driver, not the camera")
        self.assertEqual(color_for("Manovale Scenografia"), "#e3b77b")


if __name__ == "__main__":
    unittest.main()
