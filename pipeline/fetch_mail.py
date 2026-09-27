"""fetch_mail.py — downloads call sheets (ODG) and sides (STRALCI) from Gmail.

Reads the mailbox with an app password kept ONLY on this laptop:
    ~/.soundcheck/gmail.txt   line 1: the Gmail address, line 2: the app password

Which emails belong to a film is written in the film's folder (private data repo):
    projects/<film>/inbox.json   { "gmail_search": "subject:ODG has:attachment" }

PDFs are saved in projects/<film>/_inbox/<date>_<subject>/ (not committed to git:
scripts are confidential and big). Emails already downloaded are skipped.

    python pipeline/fetch_mail.py D:/sound_check_data/projects/la-buona-educazione
"""

import email
import imaplib
import json
import re
import sys
from email.header import decode_header
from email.utils import parsedate_to_datetime
from pathlib import Path


def read_login():
    path = Path.home() / ".soundcheck" / "gmail.txt"
    lines = [line.strip() for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    return lines[0], lines[1].replace(" ", "")


def decoded(value):
    """Email headers can be encoded (=?utf-8?...); turn them into plain text."""
    parts = []
    for text, charset in decode_header(value or ""):
        parts.append(text.decode(charset or "utf-8", errors="replace") if isinstance(text, bytes) else text)
    return "".join(parts)


def safe_name(text):
    return re.sub(r"[^\w .#-]+", "_", text).strip()[:80]


def fetch(film_folder):
    film = Path(film_folder)
    search = json.loads((film / "inbox.json").read_text(encoding="utf-8"))["gmail_search"]
    inbox = film / "_inbox"
    inbox.mkdir(exist_ok=True)

    address, password = read_login()
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(address, password)
    mail.select('"[Gmail]/All Mail"', readonly=True)  # read-only: never marks or moves anything

    status, found = mail.search(None, "X-GM-RAW", f'"{search}"')
    ids = found[0].split() if status == "OK" else []
    print(f"{len(ids)} email(s) match: {search}")

    new = []
    for message_id in ids:
        _, data = mail.fetch(message_id, "(RFC822)")
        message = email.message_from_bytes(data[0][1])
        subject = decoded(message["Subject"]).replace("Fwd:", "").strip()
        date = parsedate_to_datetime(message["Date"]).strftime("%Y-%m-%d")
        folder = inbox / f"{date}_{safe_name(subject)}"
        if folder.exists():
            continue
        saved = []
        for part in message.walk():
            name = decoded(part.get_filename())
            if name.lower().endswith(".pdf"):
                folder.mkdir(parents=True, exist_ok=True)
                (folder / safe_name(name)).write_bytes(part.get_payload(decode=True))
                saved.append(name)
        if saved:
            (folder / "email.json").write_text(json.dumps(
                {"subject": subject, "date": date, "from": decoded(message["From"]), "files": saved},
                ensure_ascii=False, indent=2), encoding="utf-8")
            new.append(folder.name)
            print(f"  new: {folder.name}  ({', '.join(saved)})")
    mail.logout()
    print(f"{len(new)} new email(s) saved in {inbox}")
    return new


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    fetch(sys.argv[1])
