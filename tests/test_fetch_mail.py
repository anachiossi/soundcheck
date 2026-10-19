"""The saved emails are read in the order they were sent, so the newest always wins (pipeline/fetch_mail.py).
Run: python -m unittest discover -s tests -p "test_*.py"
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from fetch_mail import emails_oldest_first  # noqa: E402


def save(inbox, name, **info):
    folder = inbox / name
    folder.mkdir()
    (folder / "email.json").write_text(json.dumps(info), encoding="utf-8")


class EmailsOldestFirstTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.inbox = Path(self.folder.name)

    def tearDown(self):
        self.folder.cleanup()

    def test_the_email_sent_last_comes_last_whatever_its_subject(self):
        # same day: by name "Re: LBE…" would sort before "ZZ…", but it was sent later
        save(self.inbox, "2026-10-18_Re LBE - ODG 21 BOZZA_bbbb", date="2026-10-18", sent="2026-10-18T19:40:00+00:00")
        save(self.inbox, "2026-10-18_ZZ LBE - ODG 21_aaaa", date="2026-10-18", sent="2026-10-18T09:15:00+00:00")
        names = [f.name for f in emails_oldest_first(self.inbox)]
        self.assertEqual(names[-1], "2026-10-18_Re LBE - ODG 21 BOZZA_bbbb")

    def test_old_emails_without_a_sent_time_go_by_their_day(self):
        save(self.inbox, "b", date="2026-10-18")
        save(self.inbox, "a", date="2026-10-16")
        self.assertEqual([f.name for f in emails_oldest_first(self.inbox)], ["a", "b"])

    def test_no_inbox_means_no_emails(self):
        self.assertEqual(emails_oldest_first(self.inbox / "missing"), [])


if __name__ == "__main__":
    unittest.main()
