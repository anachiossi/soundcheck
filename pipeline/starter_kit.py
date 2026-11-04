"""starter_kit.py — the kit every film starts with, from tools/starter-kit.json (Ana, 5 Nov 2026): TX, lavs, IFB
receivers and headphones with numbers only, so the presets and the IFB list work before the real kit is known;
and the IFB list's minimum: the director, the video assist, the 1st AD, the 2nd AD, the script supervisor, the
focus puller(s), and a few spare receivers for VIPs.

    starter_files() → {'transmitters.json': [...], 'lavaliers.json': [...], 'ifb/receivers.json': [...], 'ifb/headphones.json': [...]}
    minimum_ifb(crew) → (VIP crew entries to add, IFB rows [{crew_id, rx_id, hp_id, out}], [who was not found])

    python pipeline/starter_kit.py <film folder>     writes the starter kit and the IFB minimum into a film
                                                     that has none yet (never over a real kit)
Used by: this file (by hand, for a film made before the starter kit existed)
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "tools" / "starter-kit.json"


def template():
    return json.loads(TEMPLATE.read_text(encoding="utf-8"))


def starter_files():
    kit = template()
    numbers = lambda count: [str(n) for n in range(1, count + 1)]
    grey = kit["neutral_color"]
    return {
        "transmitters.json": [{"id": n, "model": "", "color": grey, "connector": "", "order": int(n), "frequency": ""}
                              for n in numbers(kit["transmitters"])],
        "lavaliers.json": [{"id": n, "model": "", "color": grey, "connector": "", "attenuated": False, "brand": ""}
                           for n in numbers(kit["lavaliers"])],
        "ifb/receivers.json": [{"id": n, "model": "", "color": grey, "connector": ""} for n in numbers(kit["ifb_receivers"])],
        "ifb/headphones.json": [{"id": n, "model": "", "color": grey, "connector": "", "attenuated": False}
                                for n in numbers(kit["ifb_headphones"])],
    }


def plain(text):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.lower()).strip()


def minimum_ifb(crew):
    """Who gets an IFB on day one, in this order, each with the next receiver and headphones. Two focus pullers
    (A and B camera) both get one. VIP 1, 2, 3 are new crew entries for visitors (producers, clients)."""
    kit = template()
    chosen, missing = [], []
    for need in kit["ifb_minimum"]:
        found = [person for person in crew if re.search(need["jobs"], plain(person.get("job")))]
        if need["who"] != "Focus puller":
            found = found[:1]
        if not found:
            missing.append(need["who"])
        chosen += [person for person in found if person not in chosen]
    vips = [{"id": "", "name": f"VIP {n}", "job": "VIP", "color": "#e81e1e"} for n in range(1, kit["vips"] + 1)
            if not any(person["name"] == f"VIP {n}" for person in crew)]
    next_id = max((int(p["id"]) for p in crew if str(p.get("id", "")).isdigit()), default=0)
    for vip in vips:
        next_id += 1
        vip["id"] = str(next_id)
    everyone = chosen + [p for p in crew if p.get("job") == "VIP"] + vips
    rows = [{"crew_id": person["id"], "rx_id": str(n), "hp_id": str(n), "out": False} for n, person in enumerate(everyone, 1)]
    return vips, rows, missing


def write_into(film_folder, format_json):
    """Writes the starter kit and the IFB minimum into a film that has none yet. format_json(content) → text."""
    film = Path(film_folder)
    written = []
    for path, content in starter_files().items():
        target = film / path
        current = json.loads(target.read_text(encoding="utf-8")) if target.exists() else []
        if not current:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(format_json(content), encoding="utf-8")
            written.append(path)
    crew_file, list_file = film / "ifb" / "crew.json", film / "ifb" / "list.json"
    crew = json.loads(crew_file.read_text(encoding="utf-8")) if crew_file.exists() else []
    ifb = json.loads(list_file.read_text(encoding="utf-8")) if list_file.exists() else {"rows": []}
    missing = []
    if crew and not ifb.get("rows"):
        vips, rows, missing = minimum_ifb(crew)
        crew_file.write_text(format_json(crew + vips), encoding="utf-8")
        list_file.write_text(format_json({**ifb, "rows": rows}), encoding="utf-8")
        written += ["ifb/crew.json", "ifb/list.json"]
    return written, missing


def format_json(content):
    """The same text as the app's formatJson (src/store/repo-files.js): each small record on one line."""
    text = json.dumps(content, ensure_ascii=False, indent=2)
    one_line = lambda match: (lambda line: line if len(line) <= 170 else match.group(0))(
        "{ " + re.sub(r"\n\s+", " ", match.group(1)) + " }")
    return re.sub(r"\{\n\s+([^{}\[\]]*?)\n\s+\}", one_line, text) + "\n"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    written, missing = write_into(sys.argv[1], format_json)
    print("written:", ", ".join(written) or "nothing (the film already has its kit and IFB list)")
    if missing:
        print("not found on the crew list:", ", ".join(missing))
