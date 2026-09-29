"""propose_presets.py — a PRESET REVIEW for Ana: for each shooting day from --from-day on, the
generator's TX / lav for every scene (presets.py + the film's settings.json), as a proposal she
accepts or rejects scene by scene (op set_preset), plus the checker's findings as warnings.
Shot days are never touched. Scenes Ana edited by hand are marked in the text.

    python pipeline/propose_presets.py <film folder> --from-day 8        writes proposals/presets-<date>.json
    python pipeline/propose_presets.py <film folder> --compare 1-7       how the rule differs from the
                                                                         presets really used (prints only)
"""
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from presets import day_plan, new_rows, check_scene  # noqa: E402

GENERATED_BY = ("import from Sheets", "Claude")  # presets not edited by Ana (yet)


def load_film(folder):
    folder = Path(folder)
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    film = {key: read(folder / f"{key}.json") for key in ("characters", "transmitters", "lavaliers", "schedule")}
    film["presets"] = {p.stem: read(p) for p in (folder / "presets").glob("*.json")}
    film["sound"] = {p.stem: read(p) for p in (folder / "sound").glob("*.json")} if (folder / "sound").exists() else {}
    film["lines"] = {f"{p.parent.name}/{p.stem}": read(p) for p in (folder / "lines").glob("*/*.json")}
    film["settings"] = read(folder / "settings.json")
    return film


def days_of(film):
    days = {}
    for item in sorted(film["schedule"], key=lambda s: (s["day"], s.get("order", 0))):
        days.setdefault(item["day"], {"date": item["date"], "scenes": []})["scenes"].append(str(item["scene_id"]))
    return days


def describe(film, before, after):
    names = {str(c["id"]): c["name"] for c in film["characters"]}
    parts = []
    for old, new in zip(before, after):
        change = []
        if str(old.get("tx_id", "")) != new["tx_id"]:
            change.append(f"TX {old.get('tx_id') or '—'}→{new['tx_id'] or '—'}")
        if str(old.get("lav_id", "")) != new["lav_id"]:
            change.append(f"lav {old.get('lav_id') or '—'}→{new['lav_id'] or '—'}")
        if change:
            parts.append(f"{names.get(str(new['char_id']), new['char_id'])} " + ", ".join(change))
    return parts


def review(film, first_day):
    changes, warnings = [], []
    for day, info in days_of(film).items():
        if day < first_day:
            continue
        scene_ids = [sid for sid in info["scenes"]]
        plan, kind, notes = day_plan(film, film["settings"], [s for s in scene_ids if s in film["presets"]])
        warnings += [f"Day {day}: {note}" for note in notes]
        for sid in scene_ids:
            warnings += check_scene(film, sid)
            if sid not in film["presets"]:
                continue
            before = film["presets"][sid]["rows"]
            after = new_rows(film, sid, plan)
            parts = describe(film, before, after)
            if not parts:
                continue
            by = film["presets"][sid].get("updated_by", "")
            edited = "" if by.startswith(GENERATED_BY) else f" ⚠ you edited this scene ({by})"
            changes.append({
                "id": f"c{len(changes) + 1}", "scene_id": sid,
                "text": f"Day {day} · scene {sid} ({kind} day): " + "; ".join(parts) + edited,
                "op": {"op": "set_preset", "scene_id": sid, "rows": after},
            })
    return changes, warnings


def compare(film, first, last):
    """How far the rule is from what was really used on set (days first–last)."""
    total = same = 0
    for day, info in days_of(film).items():
        if not first <= day <= last:
            continue
        plan, kind, _ = day_plan(film, film["settings"], [s for s in info["scenes"] if s in film["presets"]])
        for sid in info["scenes"]:
            if sid not in film["presets"]:
                continue
            before = film["presets"][sid]["rows"]
            parts = describe(film, before, new_rows(film, sid, plan))
            total += len(before)
            same += len(before) - len(parts)
            print(f"Day {day} scene {sid} ({kind}): " + ("same as used" if not parts else "; ".join(parts)))
    print(f"\n{same}/{total} rows exactly as used on set")


def main():
    folder = Path(sys.argv[1])
    film = load_film(folder)
    if "--compare" in sys.argv:
        first, last = map(int, sys.argv[sys.argv.index("--compare") + 1].split("-"))
        return compare(film, first, last)
    first_day = int(sys.argv[sys.argv.index("--from-day") + 1])
    changes, warnings = review(film, first_day)
    today = datetime.date.today().isoformat()
    last_day = max(days_of(film))
    proposal = {
        "id": f"presets-{today}", "kind": "presets", "title": f"Preset review · days {first_day}–{last_day}",
        "day": first_day, "date": today,
        "source": {"subject": "the preset generator (settings.json)", "received": today, "files": []},
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "status": "open" if changes else "done", "decisions": {},
        "changes": changes, "warnings": warnings,
        "checks": [f"Same TX and lav all day; rules from settings.json"], "notes": {}, "ifb_today": [],
    }
    path = folder / "proposals" / f"{proposal['id']}.json"
    path.write_text(json.dumps(proposal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(changes)} scenes to change, {len(warnings)} things to look at → {path}")


if __name__ == "__main__":
    main()
