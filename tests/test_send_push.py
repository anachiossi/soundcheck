"""test_send_push.py — who gets a notification (pipeline/send_push.py): Ana's personal alerts
(audience 'owner', the default) only reach her own phones; 'all' reaches every phone of the film.
No network: the real webpush is replaced by a fake that only remembers who it was sent to.
Made-up names only. Run (from the repo folder):
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
if "pywebpush" not in sys.modules:  # not installed here: a stand-in (the real one is never called)
    stand_in = types.ModuleType("pywebpush")
    stand_in.WebPushException = type("WebPushException", (Exception,), {"response": None})
    stand_in.webpush = lambda **kwargs: None
    sys.modules["pywebpush"] = stand_in

import send_push  # noqa: E402

PHONES = {
    "ana-phone": {"endpoint": "https://push.example/ana", "keys": {}, "device": "Ana phone"},  # old file: no role
    "office-laptop": {"endpoint": "https://push.example/laptop", "keys": {}, "person": "Office laptop", "role": "owner"},
    "davide": {"endpoint": "https://push.example/davide", "keys": {}, "person": "Davide", "role": "crew"},
}


class SendPushTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.film = Path(self.folder.name)
        (self.film / "push").mkdir()
        for name, phone in PHONES.items():
            (self.film / "push" / f"{name}.json").write_text(json.dumps(phone), encoding="utf-8")
        self.sent_to = []
        self.real_webpush = send_push.webpush
        send_push.webpush = lambda subscription, **kwargs: self.sent_to.append(subscription["endpoint"])
        environment = mock.patch.dict(send_push.os.environ, {"VAPID_PRIVATE_KEY": "test"})
        environment.start()
        self.addCleanup(environment.stop)

    def tearDown(self):
        send_push.webpush = self.real_webpush
        self.folder.cleanup()

    def test_owner_alerts_go_only_to_ana_phones_old_files_included(self):
        self.assertEqual(send_push.send(self.film, "💤 Time to sleep", "wake 06:00"), 2)
        self.assertEqual(sorted(self.sent_to), ["https://push.example/ana", "https://push.example/laptop"])

    def test_film_alerts_for_all_go_to_every_phone(self):
        self.assertEqual(send_push.send(self.film, "New call sheet", "D12", audience="all"), 3)
        self.assertIn("https://push.example/davide", self.sent_to)

    def test_a_crew_phone_never_gets_ana_personal_alerts(self):
        send_push.send(self.film, "Did today finish on time?", "Day 12", audience="owner")
        self.assertNotIn("https://push.example/davide", self.sent_to)


if __name__ == "__main__":
    unittest.main()
