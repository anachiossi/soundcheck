"""test_mail_packets.py — one email with several documents is split, one with one document is kept whole
(pipeline/mail_packets.py), and the dates that pair Il colpo's sides with their day (pipeline/sides_by_date.py).
File names are made up in the productions' style (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from mail_packets import packets  # noqa: E402

try:
    from sides_by_date import STAMP_RE, name_date
except ImportError:  # pymupdf not installed here
    STAMP_RE = None


class PacketsTest(unittest.TestCase):
    def test_an_odg_with_its_sides_stays_one_email(self):
        names = ["FILM - ODG#7.pdf", "FILM - STRALCI DAY #7.pdf"]
        self.assertEqual(packets(names), [("", names)])

    def test_a_pdl_alone_stays_one_email(self):
        self.assertEqual(packets(["FILM_ PDL 02.11.pdf"]), [("", ["FILM_ PDL 02.11.pdf"])])

    def test_several_documents_become_one_packet_each(self):
        names = ["XX - OdgDAY_12_30.10.26.pdf", "XX - OdgDAY_13_02.11.26.pdf", "XX - Stralci_13_02.11.26.pdf",
                 "XX_ PDL 02.11.pdf", "XX_OverTime Week _11.pdf"]
        self.assertEqual(packets(names), [
            ("odg-12", ["XX - OdgDAY_12_30.10.26.pdf"]), ("odg-13", ["XX - OdgDAY_13_02.11.26.pdf"]),
            ("stralci-13", ["XX - Stralci_13_02.11.26.pdf"]), ("pdl", ["XX_ PDL 02.11.pdf"]),
            ("other", ["XX_OverTime Week _11.pdf"])])

    def test_two_files_with_the_same_label_are_both_kept(self):
        labels = [label for label, _ in packets(["A ODG 5.pdf", "B ODG 5.pdf", "C PDL.pdf"])]
        self.assertEqual(labels, ["odg-5", "odg-5b", "pdl"])


@unittest.skipIf(STAMP_RE is None, "pymupdf is not installed")
class SidesDatesTest(unittest.TestCase):
    def test_the_stamp_inside_gives_number_and_date(self):
        match = STAMP_RE.search("…\nday#55_Mar_03.11\n…")
        self.assertEqual((match.group(1), match.group(2), match.group(3)), ("55", "03", "11"))

    def test_the_name_gives_its_date_as_month_and_day(self):
        self.assertEqual(name_date(Path("XX - Stralci_54_02.11.26.pdf")), "11-02")
        self.assertIsNone(name_date(Path("XX - Stralci.pdf")))


if __name__ == "__main__":
    unittest.main()
