"""test_compare.py — the day changes the email robot proposes (pipeline/compare.py → check_day).
Run (from the repo folder):
    python3 -I -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from compare import check_day  # noqa: E402

# 18 Oct, ODG #21: day 21 had 45 · 47 · 33, day 22 had only 49; the ODG swaps them
SCHEDULE = [
    {"day": 21, "date": "2026-10-19", "week": 5, "call": "08:30", "wrap": "16:30", "scene_id": "45", "order": 1},
    {"day": 21, "date": "2026-10-19", "week": 5, "call": "08:30", "wrap": "16:30", "scene_id": "47", "order": 2},
    {"day": 21, "date": "2026-10-19", "week": 5, "call": "08:30", "wrap": "16:30", "scene_id": "33", "order": 3},
    {"day": 22, "date": "2026-10-20", "week": 5, "call": "10:00", "wrap": "18:00", "scene_id": "49", "order": 1},
]


def scenes_change(changes):
    return next(change["op"] for change in changes if change["op"]["op"] == "set_day_scenes")


class CheckDayTest(unittest.TestCase):
    def test_new_scenes_for_a_day_carry_its_date_and_times(self):
        changes, _ = check_day(22, "2026-10-20", "08:30", "16:30", ["45", "47", "33"], SCHEDULE, "Day 22")
        fields = scenes_change(changes)["fields"]
        self.assertEqual(fields["date"], "2026-10-20")
        self.assertEqual((fields["call"], fields["wrap"]), ("08:30", "16:30"))
        self.assertEqual(fields["week"], 5)

    def test_a_date_the_odg_does_not_print_is_kept_from_the_schedule(self):
        changes, _ = check_day(22, "", "08:30", "16:30", ["45", "47", "33"], SCHEDULE, "Day 22")
        self.assertEqual(scenes_change(changes)["fields"]["date"], "2026-10-20")

    def test_a_brand_new_day_brings_what_the_odg_prints(self):
        changes, _ = check_day(23, "2026-10-21", "10:00", "18:00", ["51"], SCHEDULE, "Day 23")
        self.assertEqual(scenes_change(changes)["fields"], {"date": "2026-10-21", "call": "10:00", "wrap": "18:00"})


if __name__ == "__main__":
    unittest.main()
