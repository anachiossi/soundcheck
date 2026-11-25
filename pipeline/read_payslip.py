"""read_payslip.py — reads a payslip (busta paga) PDF made with Alfa Software (docs.alfasoftware.it, "Buste_dipendente
…pdf", the payroll program many Italian productions use) into plain data:

    {"production": "THE FILM", "days": ["2026-03-02", "2026-03-04"], "period": ["2026-03-02", "2026-03-04"],
     "gross": 1300.0, "net": 1180.25, "paid_on": "2026-03-10", "role": "SOUND ASSISTANT"}

What the PDF prints (the text comes out one value per line, each value BEFORE or AFTER its label):
    "Retribuzione dal 02/03/2026 al 04/03/2026"          the period
    under "Titolo Produzione": one row per day paid:    "012.001" · "THE FILM" · "02/03/2026" · "02/03/2026" · "1111"
                                                         (code, production, from, to, number); from–to can be several days
    "1.300,00" then "LORDO"                             gross
    "1.180,25" then "NETTO A PAGARE"                    net
    "Data pagamento:" … the first date after it          when it is paid
Never kept: the tax code, the IBAN, the INPS numbers (they stay inside the PDF, in Ana's private pay repo).
Used by: payslips.py

    python pipeline/read_payslip.py "path/to/Buste_dipendente.pdf"
"""

import datetime
import json
import re
import sys

DATE_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
MONEY_RE = re.compile(r"^-?[\d.]+,\d{2}$")
PERIOD_RE = re.compile(r"Retribuzione dal (\d{2}/\d{2}/\d{4}) al (\d{2}/\d{2}/\d{4})")
CODE_RE = re.compile(r"^\d{3}\.\d{3}$")   # "032.002": the start of a production row


def iso(text):
    """'09/11/2026' → '2026-11-09' (day first, as Italian payslips print it)."""
    day, month, year = DATE_RE.match(text).groups()
    return f"{year}-{month}-{day}"


def money(text):
    """'1.234,56' → 1234.56"""
    return float(text.replace(".", "").replace(",", "."))


def days_between(first, last):
    """'2026-03-02', '2026-03-04' → the three dates, both ends included."""
    start, end = datetime.date.fromisoformat(first), datetime.date.fromisoformat(last)
    return [(start + datetime.timedelta(days=n)).isoformat() for n in range((end - start).days + 1)]


def value_before(lines, label):
    """The money printed on the line just before a label ('1.300,00' · 'LORDO'), or None."""
    for index, line in enumerate(lines):
        if line == label and index and MONEY_RE.match(lines[index - 1]):
            return money(lines[index - 1])
    return None


def read_payslip_lines(lines):
    """The payslip from its lines of text (tests give them directly)."""
    lines = [line.strip() for line in lines if line.strip()]
    text = "\n".join(lines)
    period = PERIOD_RE.search(text)
    production, days = "", []
    for index, line in enumerate(lines):
        # a production row: code · title · from · to
        if CODE_RE.match(line) and index + 3 < len(lines) and DATE_RE.match(lines[index + 2]) and DATE_RE.match(lines[index + 3]):
            production = production or lines[index + 1]
            days += days_between(iso(lines[index + 2]), iso(lines[index + 3]))
    paid_on = ""
    if "Data pagamento:" in lines:
        after = lines[lines.index("Data pagamento:") + 1:]
        paid_on = next((iso(line) for line in after if DATE_RE.match(line)), "")
    role = lines[lines.index("Qualifica:") - 1] if "Qualifica:" in lines and lines.index("Qualifica:") else ""
    return {
        "production": production,
        "days": sorted(set(days)),
        "period": [iso(period.group(1)), iso(period.group(2))] if period else [],
        "gross": value_before(lines, "LORDO"),
        "net": value_before(lines, "NETTO A PAGARE"),
        "paid_on": paid_on,
        "role": role,
    }


def read_payslip(path):
    import pymupdf as fitz  # only here: the tests of the rows don't need it
    return read_payslip_lines("\n".join(page.get_text() for page in fitz.open(path)).splitlines())


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(read_payslip(sys.argv[1]), ensure_ascii=False, indent=1))
