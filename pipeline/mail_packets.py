"""mail_packets.py — splits one email that carries SEVERAL documents into packets, one per document,
so the robot reads each one (Ana, 3 Nov: the files come by WhatsApp and she forwards many in one email:
3 ODGs, 3 STRALCI, a PDL and an overtime sheet). Without this the robot saw "PDL" in the email and read
only the PDL, never the ODGs.

    an email with at most ONE document (one ODG or one PDL, with its STRALCI) → one packet, as before
        (every LBE email: "ODG #7" + "STRALCI DAY #7" stays together)
    an email with more → one packet per ODG, per PDL, per STRALCI, and one for everything else
        (the STRALCI then find their day by date: propose.py → sides_by_date)

Used by: fetch_mail.py
"""

import re

KINDS = (("ODG", "odg"), ("PDL", "pdl"), ("STRALCI", "stralci"))


def kind_of(name):
    """'IC - OdgDAY_53_30.10.26.pdf' → 'odg'; 'IC - Stralci_55_03.11.26.pdf' → 'stralci'; others → None."""
    upper = name.upper()
    return next((kind for word, kind in KINDS if word in upper), None)


def packets(names):
    """[(label, [file names])]: label '' for an email kept whole, else 'odg-53', 'stralci-55', 'pdl', 'other'."""
    documents = [n for n in names if kind_of(n) in ("odg", "pdl")]
    if len(documents) <= 1:
        return [("", list(names))]
    found, taken = [], set()
    for name in names:
        kind = kind_of(name)
        if not kind:
            continue
        number = re.search(r"(\d+)", re.sub(r"^\D*?(ODG|PDL|STRALCI)", "", name, flags=re.I))
        label = f"{kind}-{number.group(1)}" if number and kind != "pdl" else kind
        while label in taken:  # two files with the same label: both kept
            label += "b"
        taken.add(label)
        found.append((label, [name]))
    others = [n for n in names if not kind_of(n)]
    if others:
        found.append(("other", others))
    return found
