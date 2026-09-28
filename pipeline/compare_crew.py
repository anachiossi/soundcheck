"""compare_crew.py — compares the crew printed on a call sheet with the IFB crew list.
Rules (Ana, 28 Sep 2026):
  • a person on the ODG who isn't in the crew list → proposed as NEW, placed right after
    the people with the same role (else after their department), so the numbers after it
    shift by one; the IFB list follows the new numbers
  • nobody is ever removed
  • people from "PERSONALE AGGIUNTO" (hired for the day) are marked daily
  • a name spelled a bit differently (Chiosi / Chiossi) is the same person: a note, no change
  • IFB today: who on the IFB list is not on today's call sheet
Used by: propose.py
"""

import difflib
import re
import unicodedata

DAILY = "PERSONALE AGGIUNTO"


def plain(text):
    """'Guido Melzi D’Eril' → 'guido melzi deril', 'Macrì' → 'macri'."""
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z ]", "", text.lower().replace("’", "").replace("'", "")).strip()


def similar(a, b):
    return difflib.SequenceMatcher(None, plain(a), plain(b)).ratio()


ABBREVIATIONS = {"a to": "aiuto", "ato": "aiuto", "ass": "assistente", "segr": "segretario", "segretaria": "segretario",
                 "prod": "produzione", "csq": "capo squadra", "c sq": "capo squadra", "1st": "primo", "2nd": "secondo",
                 "ii": "secondo", "elettricisti": "elettricista", "macchinisti": "macchinista"}


def role_words(role):
    """'Aiuto Segr. di Prod.' and 'A.to Segretario di Produzione' → the same words."""
    text = unicodedata.normalize("NFKD", str(role or "")).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text.replace("a.to", "aiuto").replace("c.sq", "capo squadra"))
    words = [ABBREVIATIONS.get(word, word) for word in text.split() if word not in ("di", "del", "della", "e", "alla", "al")]
    return set(" ".join(words).split())


def same_role(a, b):
    first, second = role_words(a), role_words(b)
    return bool(first and second) and len(first & second) / len(first | second) >= 0.6


def find_person(name, crew):
    """(crew member, exact?) for a name on the ODG."""
    for person in crew:
        if plain(person["name"]) == plain(name):
            return person, True
    best = max(crew, key=lambda person: similar(person["name"], name), default=None)
    if best and similar(best["name"], name) >= 0.85:
        return best, False
    return None, False


def check_crew(odg_crew, crew, ifb_rows):
    changes, notes, checks, ifb_today = [], [], [], []
    order = [dict(person) for person in crew]          # the list as it will be after each addition
    found = {}                                          # crew name → ODG entry
    new_people = []
    department_of = {}                                  # crew name → ODG department (from matches)

    for entry in odg_crew:
        person, exact = find_person(entry["name"], order)
        if person:
            found[person["name"]] = entry
            department_of[person["name"]] = entry["department"]
            if not exact:
                notes.append(f"{entry['name']} = {person['name']}")
            continue
        # New: after the last person with the same role, else after the last one of the department.
        daily = entry["department"] == DAILY
        with_role = [p for p in order if same_role(p.get("job"), entry["role"])]
        # a daily hire with no known role goes after the other daily people, at the end
        others = [p for p in order if p.get("daily")] if daily else                  [p for p in order if department_of.get(p["name"]) == entry["department"]]
        neighbour = (with_role or others or order[-1:] or [None])[-1]
        person = {"name": entry["name"], "job": entry["role"],
                  "color": (neighbour or {}).get("color", "#e8e4e1")}
        if daily:
            person["daily"] = True
        at = order.index(neighbour) + 1 if neighbour else len(order)
        order.insert(at, person)
        department_of[person["name"]] = entry["department"]
        found[person["name"]] = entry
        new_people.append(person["name"])
        tag = " · daily" if daily else ""
        changes.append({
            "text": f"Crew: add {entry['name']} ({entry['role']}{tag}) after {neighbour['name'] if neighbour else 'the last one'}",
            "op": {"op": "add_crew_member", "person": person, "after_name": neighbour["name"] if neighbour else ""},
        })

    if notes:
        checks.append("Same people, spelled differently on the ODG: " + " · ".join(notes))
    checks.append(f"Crew on the ODG: {len(odg_crew)} people, {len(odg_crew) - len(new_people)} already in the IFB crew")

    by_id = {person["id"]: person for person in crew}
    for row in ifb_rows:
        person = by_id.get(row.get("crew_id"))
        if person and person["name"] not in found:
            stand_ins = [e["name"] for e in odg_crew if e["name"] in new_people and same_role(e["role"], person.get("job"))]
            instead = f" · today in that role: {', '.join(stand_ins)}" if stand_ins else ""
            ifb_today.append(f"{person['name']} (RX {row.get('rx_id') or '—'}) is not on today's call sheet{instead}")
    return changes, checks, ifb_today
