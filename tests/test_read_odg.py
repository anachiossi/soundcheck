"""test_read_odg.py — the ODG reader's scene table (pipeline/read_odg.py), with the lines exactly as
the PDFs print them. Run (from the repo folder):
    python3 -I -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

try:
    from read_odg import read_scene_table
except ImportError:  # pymupdf not installed here
    read_scene_table = None

SCENE_49 = ["49", "3A", "E / G", "CASTELLO - PIAZZALE INGRESSO",
            "Mentre i domestici riportano gli ospiti nella dispensa, Ines li osserva contrita.", "stata lei a farli scappare."]


@unittest.skipIf(read_scene_table is None, "pymupdf not installed")
class SceneTableTest(unittest.TestCase):
    def test_a_cast_wrapped_after_a_forgotten_comma_is_read_whole(self):  # ODG #21
        scene = read_scene_table(SCENE_49 + ["1, 2, 4, 5, 6, 7, 12 13,", "14, 15", "7/8", "FRONTE CASTELLO"])[0]
        self.assertEqual(scene["cast"], ["1", "2", "4", "5", "6", "7", "12", "13", "14", "15"])
        self.assertTrue(scene["synopsis"].endswith("scappare."))
        self.assertEqual((scene["pages"], scene["location"]), ("7/8", "FRONTE CASTELLO"))

    def test_a_cast_wrapped_with_no_comma_at_the_end_of_the_line_is_read_whole(self):  # ODG #21 BOZZA
        scene = read_scene_table(SCENE_49 + ["1, 2, 3, 4, 5, 6, 7, 12", "13, 14, 15", "7/8", "FRONTE CASTELLO"])[0]
        self.assertEqual(scene["cast"], ["1", "2", "3", "4", "5", "6", "7", "12", "13", "14", "15"])
        self.assertEqual((scene["pages"], scene["location"]), ("7/8", "FRONTE CASTELLO"))

    def test_a_short_cast_then_a_whole_page_count_stay_apart(self):
        scene = read_scene_table(SCENE_49 + ["1, 4", "2", "PIANO TERRA"])[0]
        self.assertEqual((scene["cast"], scene["pages"]), (["1", "4"], "2"))


if __name__ == "__main__":
    unittest.main()
