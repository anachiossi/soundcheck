"""test_day_documents.py — the map and the other papers of a day's ODG email go to docs/day-<n>/, the transport list
never (pipeline/day_documents.py). File names are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from day_documents import day_in_subject, extra_documents, is_map, is_transport  # noqa: E402


class DayDocumentsTest(unittest.TestCase):
    def test_the_map_is_known_by_its_name(self):
        self.assertTrue(is_map("Mappa Day#27.pdf"))
        self.assertTrue(is_map("IC - MAPPE_56.pdf"))
        self.assertTrue(is_map("Map 3.jpg"))
        self.assertFalse(is_map("Rimappatura costumi.pdf"))

    def test_the_transport_list_is_never_kept(self):
        self.assertTrue(is_transport("Lista trasporti Venerdì 6 novembre.pdf"))
        self.assertTrue(is_transport("TRANSPORT LIST.pdf"))
        self.assertTrue(is_transport("TL#26 DEL 511.pdf"), "Lux Vide calls it TL")
        self.assertFalse(is_transport("CASTLE plan.pdf"))
        self.assertFalse(is_transport("ODG#27.pdf"))

    def test_an_email_with_no_odg_finds_its_day_in_the_subject(self):
        self.assertEqual(day_in_subject("Fwd: R: FILM | ODG#27 - Venerdì 6 novembre"), 27)
        self.assertEqual(day_in_subject("FILM | ODG #56 del 4 Novembre + Mappe"), 56)
        self.assertIsNone(day_in_subject("FILM | ODG #53, ODG #54"), "two days: not sure which")
        self.assertIsNone(day_in_subject("Lista contatti"))

    def test_every_other_paper_goes_next_to_the_odg_and_the_map_is_called_map(self):
        with tempfile.TemporaryDirectory() as folder:
            names = ["ODG#27.pdf", "Stralci Day#27.pdf", "Lista trasporti.pdf", "Mappa Day#27.pdf", "Mappa 2.jpg",
                     "IC PROTOCOLLO SET CHIUSO.pdf", "email.json"]
            for name in names:
                (Path(folder) / name).write_text("x")
            odg, sides = Path(folder) / "ODG#27.pdf", Path(folder) / "Stralci Day#27.pdf"
            found = [(source.name, name) for source, name in extra_documents(folder, {odg, sides})]
        self.assertEqual(found, [("IC PROTOCOLLO SET CHIUSO.pdf", "IC PROTOCOLLO SET CHIUSO.pdf"),
                                 ("Mappa 2.jpg", "map.jpg"), ("Mappa Day#27.pdf", "map-2.pdf")])


if __name__ == "__main__":
    unittest.main()
