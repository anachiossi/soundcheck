"""test_payslips.py — the payslip reader (pipeline/read_payslip.py) and the filing into the private pay repo
(pipeline/payslips.py). Names, numbers and amounts are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from read_payslip import read_payslip_lines  # noqa: E402

LINES = """SOME PRODUCTIONS SRL
SOUND ASSISTANT
Qualifica:
Retribuzione dal 02/03/2026 al 05/03/2026
Titolo Produzione
CodBud
012.001
THE FILM
02/03/2026
02/03/2026
 1111
012.001
THE FILM
04/03/2026
05/03/2026
 1112
 1.300,00
LORDO
 1.180,25
NETTO A PAGARE
Firma per quietanza:
Data pagamento:
CUP regionale (08) :
10/03/2026
Banca:
IBAN:
IT00X0000000000000000000000""".splitlines()


class ReadPayslipTest(unittest.TestCase):
    def setUp(self):
        self.slip = read_payslip_lines(LINES)

    def test_each_production_row_gives_its_days_and_a_range_gives_every_day(self):
        self.assertEqual(self.slip["days"], ["2026-03-02", "2026-03-04", "2026-03-05"])
        self.assertEqual(self.slip["production"], "THE FILM")

    def test_the_period_gross_net_and_payment_date_are_read(self):
        self.assertEqual(self.slip["period"], ["2026-03-02", "2026-03-05"])
        self.assertEqual((self.slip["gross"], self.slip["net"]), (1300.0, 1180.25))
        self.assertEqual(self.slip["paid_on"], "2026-03-10")
        self.assertEqual(self.slip["role"], "SOUND ASSISTANT")

    def test_the_iban_is_never_kept(self):
        self.assertNotIn("IT00X", json.dumps(self.slip))


try:
    from payslips import file_payslip, plain  # needs the mail code's imports, which need pymupdf
except ImportError:
    file_payslip = None


@unittest.skipIf(file_payslip is None, "pymupdf is not installed")
class FilePayslipTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.read = lambda path: read_payslip_lines(LINES)

    def test_a_payslip_goes_to_its_film_with_its_entry(self):
        film, entry = file_payslip(self.folder, {"the film": "the-film"}, b"pdf one", "2026-03-11", read=self.read)
        self.assertEqual(film, "the-film")
        self.assertTrue((self.folder / "the-film" / entry["file"]).exists())
        listed = json.loads((self.folder / "the-film" / "payslips.json").read_text())
        self.assertEqual(listed[0]["days"], ["2026-03-02", "2026-03-04", "2026-03-05"])

    def test_the_same_payslip_sent_twice_is_filed_once(self):
        file_payslip(self.folder, {"the film": "the-film"}, b"pdf one", "2026-03-11", read=self.read)
        self.assertIsNone(file_payslip(self.folder, {"the film": "the-film"}, b"pdf one", "2026-03-12", read=self.read))

    def test_a_production_with_no_film_is_kept_apart(self):
        film, _ = file_payslip(self.folder, {}, b"pdf two", "2026-03-11", read=self.read)
        self.assertEqual(film, "unsorted")

    def test_names_match_without_capitals_or_accents(self):
        self.assertEqual(plain("  Il  Còlpo "), "il colpo")


if __name__ == "__main__":
    unittest.main()
