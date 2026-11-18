"""test_late_call_sheet.py — a call sheet that arrives after its day is kept while the next day it announces is to come
(run.py → all_past). No network, no PDFs. Run (from the repo folder):
    python3 -I -m unittest discover -s tests -p "test_*.py"
"""

import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
for missing in ("pymupdf", "pywebpush"):  # PDF reader and push sender, not installed here and never used
    try:
        __import__(missing)
    except ImportError:
        stand_in = types.ModuleType(missing)
        stand_in.WebPushException = type("WebPushException", (Exception,), {"response": None})
        stand_in.webpush = lambda **kwargs: None
        sys.modules[missing] = stand_in

import run  # noqa: E402


class LateCallSheetTest(unittest.TestCase):
    def test_a_call_sheet_that_arrives_after_its_day_is_kept_while_its_next_day_is_to_come(self):
        self.assertFalse(run.all_past({"date": "2026-11-13", "next_date": "2026-11-16"}, "2026-11-14"))
        self.assertTrue(run.all_past({"date": "2026-11-12", "next_date": "2026-11-13"}, "2026-11-14"))
        self.assertTrue(run.all_past({"date": "2026-11-12"}, "2026-11-14"))  # an older proposal: no next day kept
        self.assertFalse(run.all_past({"date": "2026-11-14", "next_date": ""}, "2026-11-14"))


if __name__ == "__main__":
    unittest.main()
