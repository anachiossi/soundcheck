"""test_wake_plan.py — the robots follow Ana's "My call" (settings.json commute "my_name"):
pipeline/wake_plan.py and run.py → tell_tomorrow. Her name found on that day's calls.json → her own
call; not there → the day's general call; riding with someone still starts from their call.
The fixed times are the SAME as in tests/robots-my-call.test.js (the app's wakePlan): app and robots agree.
No network, no PDFs: send_push.send is replaced by a fake. Made-up names only. Run (from the repo folder):
    python3 -I -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

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
import send_push  # noqa: E402
from wake_plan import COMMUTE, wake_plan  # noqa: E402

CALLS = {"Inês  Rossi": "08:50", "Maria Bianchi": "09:30"}  # day 12, 2026-10-20; general call 10:00


def times(plan):
    return [plan["call"], plan["meet"], plan["leave_from"], plan["leave_to"], plan["wake"], plan["sleep"]]


class WakePlanTest(unittest.TestCase):
    def test_my_name_on_the_sheet_gives_my_own_call(self):
        plan = wake_plan({**COMMUTE, "my_name": "ines rossi"}, "10:00", CALLS)
        self.assertEqual(times(plan), ["08:50", "08:05", "06:35", "06:50", "05:50", "21:50"])

    def test_names_match_with_no_capitals_accents_or_extra_spaces(self):
        for typed in ("INES ROSSI", "  Inês Rossi ", "Ines   rossi"):
            self.assertEqual(wake_plan({**COMMUTE, "my_name": typed}, "10:00", CALLS)["call"], "08:50", typed)

    def test_my_name_not_on_the_sheet_uses_the_general_call(self):
        plan = wake_plan({**COMMUTE, "my_name": "Someone Else"}, "10:00", CALLS)
        self.assertEqual([plan["call"], plan["wake"], plan["sleep"]], ["10:00", "07:00", "23:00"])

    def test_no_my_name_uses_the_general_call_as_before(self):
        self.assertEqual(wake_plan(COMMUTE, "10:00", CALLS)["call"], "10:00")

    def test_riding_with_someone_still_starts_from_their_call(self):
        ride = {**COMMUTE, "my_name": "Ines Rossi", "ride_with": "Maria Bianchi"}
        self.assertEqual(wake_plan(ride, "10:00", CALLS)["wake"], "06:30")
        unknown = {**COMMUTE, "my_name": "Ines Rossi", "ride_with": "Nobody Known"}
        self.assertEqual(wake_plan(unknown, "10:00", CALLS)["wake"], "05:10")  # 40 min before MY call


class TellTomorrowTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.film = Path(self.folder.name)
        (self.film / "push").mkdir()
        (self.film / "push" / "ana-phone.json").write_text("{}", encoding="utf-8")
        (self.film / "calls.json").write_text(json.dumps({"2026-10-20": CALLS}), encoding="utf-8")
        self.sent = []
        fake = mock.patch.object(send_push, "send", lambda film, title, body, url, **kwargs: self.sent.append((title, body, kwargs)))
        fake.start()
        self.addCleanup(fake.stop)
        environment = mock.patch.dict(run.os.environ, {"VAPID_PRIVATE_KEY": "test"})
        environment.start()
        self.addCleanup(environment.stop)

    def settings(self, commute):
        (self.film / "settings.json").write_text(json.dumps({"commute": commute}), encoding="utf-8")

    def test_tomorrow_follows_my_name_and_only_reaches_ana(self):
        self.settings({"my_name": "Inês Rossi"})
        run.tell_tomorrow(self.film, [{"day": 12, "date": "2026-10-20", "call": "10:00"}])
        title, body, options = self.sent[0]
        self.assertEqual(title, "Tomorrow D12 · call 08:50")
        self.assertIn("⏰ wake 05:50", body)
        self.assertEqual(options["audience"], "owner")

    def test_tomorrow_without_my_name_uses_the_general_call(self):
        self.settings({})
        run.tell_tomorrow(self.film, [{"day": 12, "date": "2026-10-20", "call": "10:00"}])
        self.assertEqual(self.sent[0][0], "Tomorrow D12 · call 10:00")
        self.assertIn("⏰ wake 07:00", self.sent[0][1])


if __name__ == "__main__":
    unittest.main()
