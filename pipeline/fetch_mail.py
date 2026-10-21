"""fetch_mail.py — downloads call sheets (ODG) and sides (STRALCI) from Gmail.

Reads the mailbox with an app password:
    on the laptop: ~/.soundcheck/gmail.txt   line 1: the Gmail address, line 2: the app password
    in the cloud (GitHub Actions): the secrets GMAIL_ADDRESS and GMAIL_APP_PASSWORD

Which emails belong to a film is written in the film's folder (private data repo):
    projects/<film>/inbox.json   { "gmail_search": "subject:ODG has:attachment" }

PDFs are saved in projects/<film>/_inbox/<date>_<subject>_<id>/ (not committed to git; run.py
copies every email's PDFs to docs/archive/ in the private data repo, outdated ones too). Each email is recognised by its own Message-ID, so a
corrected ODG sent again with the same subject is still a new email.

    python pipeline/fetch_mail.py D:/sound_check_data/projects/la-buona-educazione
"""

import email
import hashlib
import imaplib
import json
import os
import re
import sys
from email.header import decode_header
from datetime import timezone
from email.utils import parsedate_to_datetime
from pathlib import Path


def read_login():
    if os.environ.get("GMAIL_APP_PASSWORD"):
        return os.environ["GMAIL_ADDRESS"], os.environ["GMAIL_APP_PASSWORD"].replace(" ", "")
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


def emails_oldest_first(inbox):
    """The saved emails in the order they were sent, to the second: the newest always wins, whatever
    its subject or file names say (Ana, 19 Oct: ODG #21 "BOZZA" was sent last and was the real one).
    Emails saved before "sent" existed fall back to their day."""
    inbox = Path(inbox)
    if not inbox.exists():
        return []

    def sent(folder):
        info = json.loads((folder / "email.json").read_text(encoding="utf-8"))
        return info.get("sent") or info.get("date", "")

    return sorted((f for f in inbox.iterdir() if (f / "email.json").exists()), key=lambda f: (sent(f), f.name))


def open_mailbox():
    address, password = read_login()
    mail = imaplib.IMAP4_SSL("imap.gmail.com", timeout=60)  # never wait forever for Gmail (20 Oct: a run hung 10 min)
    mail.login(address, password)
    mail.select('"[Gmail]/All Mail"', readonly=True)  # read-only: never marks or moves anything
    return mail


TRIES = 4  # Gmail sometimes cuts the connection mid-download (21 Oct: "socket error: EOF" after 6 min)


HEADER_ONLY = "(BODY.PEEK[HEADER])"  # subject, date, Message-ID: a few hundred bytes, no PDFs
WHOLE_EMAIL = "(RFC822)"


def ask_gmail(mailbox, uids, what):
    """Gmail's answer for these emails (whole, or only their headers). When Gmail cuts the connection, connect
    again and ask again. UIDs (not the 1, 2, 3 order numbers) so the same number means the same email after
    reconnecting."""
    for attempt in range(1, TRIES + 1):
        try:
            return mailbox["mail"].uid("fetch", uids, what)[1]
        except (imaplib.IMAP4.abort, OSError) as error:
            if attempt == TRIES:
                raise
            print(f"  Gmail cut the connection ({error}), connecting again ({attempt} of {TRIES - 1})")
            mailbox["mail"] = mailbox["open"]()


def all_headers(mailbox, ids):
    """{uid: header bytes} for every email, in one request to Gmail (one at a time took 1.5 min for 28)."""
    if not ids:
        return {}
    headers = {}
    for item in ask_gmail(mailbox, b",".join(ids), HEADER_ONLY):
        if isinstance(item, tuple):  # (b'5 (UID 7 BODY[HEADER] {512}', header bytes)
            uid = re.search(rb"UID (\d+)", item[0]).group(1)
            headers[uid] = item[1]
    return headers


def fetch(film_folder, open_mail=open_mailbox):
    film = Path(film_folder)
    search = json.loads((film / "inbox.json").read_text(encoding="utf-8"))["gmail_search"]
    inbox = film / "_inbox"
    inbox.mkdir(exist_ok=True)

    mailbox = {"mail": open_mail(), "open": open_mail}
    status, found = mailbox["mail"].uid("search", None, "X-GM-RAW", f'"{search}"')
    ids = found[0].split() if status == "OK" else []
    print(f"{len(ids)} email(s) match: {search}")

    # the headers first, all in one request: an email already saved is never downloaded again
    # (21 Oct: every run downloaded all 28 emails with their PDFs, and Gmail cut the connection)
    headers = all_headers(mailbox, ids)
    new = []
    for uid in ids:
        header = email.message_from_bytes(headers[uid])
        subject = decoded(header["Subject"]).replace("Fwd:", "").strip()
        sent_at = parsedate_to_datetime(header["Date"])
        date = sent_at.strftime("%Y-%m-%d")
        message_id = (header["Message-ID"] or f"{date}-{subject}").strip()
        short_id = hashlib.sha1(message_id.encode()).hexdigest()[:8]  # unique per email
        folder = inbox / f"{date}_{safe_name(subject)}_{short_id}"
        if folder.exists():
            continue
        message = email.message_from_bytes(ask_gmail(mailbox, uid, WHOLE_EMAIL)[0][1])
        saved = []
        for part in message.walk():
            name = decoded(part.get_filename())
            if name.lower().endswith(".pdf"):
                folder.mkdir(parents=True, exist_ok=True)
                (folder / safe_name(name)).write_bytes(part.get_payload(decode=True))
                saved.append(name)
        if saved:
            (folder / "email.json").write_text(json.dumps(
                {"subject": subject, "date": date, "sent": sent_at.astimezone(timezone.utc).isoformat(),
                 "from": decoded(message["From"]), "files": saved,
                 "message_id": message_id},
                ensure_ascii=False, indent=2), encoding="utf-8")
            new.append(folder.name)
            print(f"  new: {folder.name}  ({', '.join(saved)})")
    mailbox["mail"].logout()
    print(f"{len(new)} new email(s) saved in {inbox}")
    return new


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    fetch(sys.argv[1])
