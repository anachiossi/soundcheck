"""The saved emails are read in the order they were sent, so the newest always wins (pipeline/fetch_mail.py).
Run: python -m unittest discover -s tests -p "test_*.py"
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

import imaplib  # noqa: E402

from fetch_mail import emails_oldest_first, fetch  # noqa: E402


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


class FakeGmail:
    """Pretends to be Gmail: one email with a PDF; the first download is cut ("socket error: EOF")."""
    connections = 0
    asked = []  # what was fetched: header only or the whole email

    def __init__(self):
        FakeGmail.connections += 1

    def uid(self, command, *args):
        if command == "search":
            return "OK", [b"7"]
        FakeGmail.asked.append(args[1])
        if FakeGmail.connections == 1:
            raise imaplib.IMAP4.abort("socket error: EOF")
        if args[1] == "(BODY.PEEK[HEADER])":
            return "OK", [(b"1 (UID 7 BODY[HEADER] {200}", EMAIL.split(b"\r\n\r\n")[0]), b")"]
        return "OK", [(b"1 (UID 7 RFC822 {400}", EMAIL), b")"]

    def logout(self):
        pass


EMAIL = (b"Subject: LBE - ODG #23\r\nDate: Tue, 20 Oct 2026 18:00:00 +0200\r\nMessage-ID: <odg23@x>\r\n"
         b"Content-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: application/pdf\r\n"
         b"Content-Disposition: attachment; filename=\"LBE - ODG#23.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\n"
         b"JVBERi0=\r\n--B--\r\n")


class GmailCutsTheConnectionTest(unittest.TestCase):
    def test_a_cut_connection_is_opened_again_and_the_email_is_still_saved(self):
        with tempfile.TemporaryDirectory() as folder:
            film = Path(folder)
            (film / "inbox.json").write_text(json.dumps({"gmail_search": "subject:ODG"}), encoding="utf-8")
            FakeGmail.connections = 0
            new = fetch(film, open_mail=FakeGmail)
            self.assertEqual(FakeGmail.connections, 2)
            self.assertEqual(len(new), 1)
            self.assertTrue((film / "_inbox" / new[0] / "LBE - ODG#23.pdf").exists())

    def test_an_email_already_saved_is_read_by_its_header_only_never_downloaded_again(self):
        with tempfile.TemporaryDirectory() as folder:
            film = Path(folder)
            (film / "inbox.json").write_text(json.dumps({"gmail_search": "subject:ODG"}), encoding="utf-8")
            FakeGmail.connections = 1  # no cut this time
            fetch(film, open_mail=FakeGmail)
            FakeGmail.asked = []
            self.assertEqual(fetch(film, open_mail=FakeGmail), [])
            self.assertEqual(FakeGmail.asked, ["(BODY.PEEK[HEADER])"])


if __name__ == "__main__":
    unittest.main()
