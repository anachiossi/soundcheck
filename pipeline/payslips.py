"""payslips.py — files the payslips (buste paga) from the robot's mailbox into Ana's PRIVATE pay repo, one folder per
film (Ana, 25 Nov: "a paycheck page on the app to keep track of weeks and days"). Never into the data repo: a crew key
for a film can read that repo, and a payslip shows the IBAN, the tax code and the pay.

    soundcheck-pay/
      <film-id>/payslips.json            [{ file, sha, email_date, paid_on, period, days, gross, net, production, role }]
      <film-id>/payslips/2026-11-18_3fa2c1d0.pdf
      unsorted/…                         a payslip whose production matches no film (said in the run's log)

Which emails: those with a "Buste_dipendente…pdf" attachment (Alfa Software's name for them). Ana forwards them, or
a Gmail filter forwards them, from her own mailbox to the robot's. Which film: the production printed on the payslip
("IL COLPO") against each film's name in the data repo (projects/*/film.json), without capitals or accents.
A payslip already filed (same bytes) is never filed twice. The PDF is read by read_payslip.py.
Run by the data repo's workflow emails.yml, after the production emails, only when the secret PAY_REPO_TOKEN is set.

    python pipeline/payslips.py <pay repo folder> <data repo folder>
"""

import email
import hashlib
import json
import sys
import unicodedata
from email.utils import parsedate_to_datetime
from pathlib import Path

from fetch_mail import decoded, open_mailbox
from read_payslip import read_payslip

GMAIL_SEARCH = "has:attachment filename:Buste_dipendente"


def plain(text):
    """'Il Colpo ' → 'il colpo' (no capitals, accents or extra spaces), to match a payslip with its film."""
    letters = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return " ".join(letters.lower().split())


def film_folders(data_repo):
    """{'il colpo': 'il-colpo', …} from every film's film.json."""
    films = {}
    for film_file in Path(data_repo, "projects").glob("*/film.json"):
        name = json.loads(film_file.read_text(encoding="utf-8")).get("name")
        if name:
            films[plain(name)] = film_file.parent.name
    return films


def filed_shas(pay_repo):
    """Every payslip already filed, by the fingerprint of its bytes."""
    shas = set()
    for index in Path(pay_repo).glob("*/payslips.json"):
        shas |= {entry["sha"] for entry in json.loads(index.read_text(encoding="utf-8"))}
    return shas


def file_payslip(pay_repo, films, pdf_bytes, email_date, read=read_payslip):
    """Saves one payslip and adds it to its film's list. Returns (folder, entry); None when it was filed before."""
    sha = hashlib.sha1(pdf_bytes).hexdigest()
    if sha in filed_shas(pay_repo):
        return None
    folder = Path(pay_repo)
    temporary = folder / f".new_{sha[:8]}.pdf"
    temporary.write_bytes(pdf_bytes)
    try:
        slip = read(temporary)
    finally:
        temporary.unlink()
    film = films.get(plain(slip["production"]), "unsorted")
    name = f"payslips/{slip['paid_on'] or email_date}_{sha[:8]}.pdf"
    (folder / film / "payslips").mkdir(parents=True, exist_ok=True)
    (folder / film / name).write_bytes(pdf_bytes)
    entry = {"file": name, "sha": sha, "email_date": email_date, **slip}
    index = folder / film / "payslips.json"
    entries = json.loads(index.read_text(encoding="utf-8")) if index.exists() else []
    entries.append(entry)
    entries.sort(key=lambda one: (one["paid_on"] or one["email_date"], one["file"]))
    index.write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return film, entry


def fetch_payslips(pay_repo, data_repo, open_mail=open_mailbox):
    films = film_folders(data_repo)
    mail = open_mail()
    status, found = mail.uid("search", None, "X-GM-RAW", f'"{GMAIL_SEARCH}"')
    uids = found[0].split() if status == "OK" else []
    print(f"{len(uids)} email(s) with payslips")
    filed = 0
    for uid in uids:
        message = email.message_from_bytes(mail.uid("fetch", uid, "(RFC822)")[1][0][1])
        email_date = parsedate_to_datetime(message["Date"]).strftime("%Y-%m-%d")
        for part in message.walk():
            name = decoded(part.get_filename())
            if not name.lower().endswith(".pdf") or "buste" not in name.lower():
                continue
            done = file_payslip(pay_repo, films, part.get_payload(decode=True), email_date)
            if done:
                film, entry = done
                filed += 1
                print(f"  {film}: payslip paid {entry['paid_on'] or '?'} for {', '.join(entry['days']) or 'no day read'}")
    mail.logout()
    print(f"{filed} new payslip(s)")
    return filed


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    fetch_payslips(sys.argv[1], sys.argv[2])
