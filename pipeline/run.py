"""run.py — the whole morning check, in one go:
    1. download new production emails (fetch_mail.py)
    2. for each new email: an ODG of today or later (+ its sides, from the same email or a later
       one) → proposals/odg-<n>.json; an untouched proposal made without sides is made again
       when its sides arrive
       (propose.py); a PDL (+ scaletta) → a whole review from today on → proposals/pdl-<date>.json
       (propose_pdl.py)
    3. file each ODG email's PDFs as projects/<film>/docs/day-<n>/odg.pdf and sides.pdf, so the
       app can open them offline (📄 buttons on each day), and the sides' lines for 🎙 Cues;
       the other official PDFs (outdated versions, PDLs, scalette, maps) go to docs/archive/ (kept forever)
    4. commit + push the new proposals and documents to the private data repo

Only proposals are written. The film's data changes only when Ana accepts them in the app.

    python pipeline/run.py D:/sound_check_data/projects/la-buona-educazione
    python pipeline/run.py <film folder> --all      (also days already shot, for testing)
    python pipeline/run.py --every-film <data repo>
        every film with an inbox.json (GitHub Actions runs it every 30 minutes, 04–10 and 17–24 Rome:
        the hours are set only in .github/workflows/emails.yml — GitHub often starts a run late,
        and a late run must still read the emails)
"""

import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_mail import fetch  # noqa: E402
from propose import build_proposal, sides_by_day, NO_SIDES  # noqa: E402
from propose_pdl import build_pdl_proposal  # noqa: E402


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout


def write_json(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(film_folder, include_past=False):
    film = Path(film_folder)
    repo = film.parent.parent
    git(repo, "pull", "--rebase", "--autostash", "--quiet")
    fetch(film)

    today = datetime.date.today().isoformat()
    proposals = film / "proposals"
    # emails already turned into a proposal: by Message-ID (older proposals: by subject)
    known = set()
    for path in proposals.glob("*.json") if proposals.exists() else []:
        source = json.loads(path.read_text(encoding="utf-8"))["source"]
        known.add(source.get("message_id") or source["subject"])

    written = []
    other_sides = sides_by_day(film / "_inbox")
    for email_folder in sorted((film / "_inbox").iterdir()):
        info = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
        if info.get("message_id") in known or info["subject"] in known:
            continue
        names = " ".join(info["files"]).upper()
        if "PDL" in names:
            proposal = build_pdl_proposal(film, email_folder)
        elif "ODG" in names:
            proposal = build_proposal(film, email_folder, other_sides)
            if proposal["date"] < today and not include_past:
                continue
        else:
            continue
        name = proposal["id"]
        while (proposals / f"{name}.json").exists():  # a corrected ODG with the same number
            name += "-new"
        proposal["id"] = name
        proposal["source"]["message_id"] = info.get("message_id", "")
        write_json(proposals / f"{name}.json", proposal)
        written.append(proposal)
        print(f"proposal {name}: {len(proposal['changes'])} changes, {len(proposal['warnings'])} warnings, "
              f"{len(proposal['checks'])} checks OK")

    written += add_late_sides(film, other_sides)
    documents = file_documents(film, other_sides)
    if documents:
        print(f"documents: {', '.join(documents)}")
    tell_tomorrow(film, [p for p in written if p["id"].startswith("odg") and p["date"] >= today])
    tell_lavs(film, [p for p in written if p["id"].startswith("odg") and p["date"] >= today])
    if written or documents:
        if written:
            git(repo, "add", str(proposals))
        if documents:
            git(repo, "add", str(film / "docs"), str(film / "lines"),
                *([str(film / "calls.json")] if (film / "calls.json").exists() else []))
        titles = ", ".join([p["title"] for p in written] + ([f"{len(documents)} document(s)"] if documents else []))
        git(repo, "commit", "--quiet", "-m", f"From production emails: {titles}")
        git(repo, "push", "--quiet")
        print("pushed: the app will show them at the next sync")
    else:
        print("nothing new")
    return written


def tell_tomorrow(film, odgs):
    """A new ODG for an upcoming day → a notification to the phones with "🔔 Wrap alerts" on:
    "Tomorrow D10 · call 10:00 / ⏰ wake 07:00 · 🚪 leave 07:45–08:00 · 💤 sleep 23:00"; a tap opens the
    app's Hours screen with ⏰ Set alarms. Only for films with a wake-up plan (settings "commute").
    The call is Ana's own (commute "my_name" found in calls.json that day), else the ODG's general call
    (wake_plan.py). Only to Ana's phones (audience 'owner'): it is her plan, not the crew's."""
    from wake_plan import commute_of, wake_plan
    commute = commute_of(film)
    if not odgs or not commute or not os.environ.get("VAPID_PRIVATE_KEY") or not any((film / "push").glob("*.json")):
        return
    from send_push import send
    calls = json.loads((film / "calls.json").read_text(encoding="utf-8")) if (film / "calls.json").exists() else {}
    for odg in odgs:
        plan = wake_plan(commute, odg.get("call"), calls.get(odg.get("date"), {}))
        if plan:
            ride = f" · {commute['ride_with'].split()[0]} {plan['ride_call']}" if plan["ride_call"] else ""
            send(film, f"Tomorrow D{odg['day']:02d} · call {plan['call']}{ride}",
                 f"⏰ wake {plan['wake']} · 🚪 leave {plan['leave_from']}–{plan['leave_to']} · 💤 sleep {plan['sleep']} — tap to set the alarms",
                 "./#hours", tag="tomorrow", audience="owner")


def tell_lavs(film, odgs):
    """A new ODG → "🎙 D18 lavs ready" to the phones with notifications on; a tap opens the app's
    Day 18 share screen (screens/lav-share.js): one button → the mic list image → WhatsApp / Save Image.
    Sent as soon as the ODG lands, before Ana's review (Ana, 12 Oct): the app says when it's a draft."""
    if not odgs or not os.environ.get("VAPID_PRIVATE_KEY") or not any((film / "push").glob("*.json")):
        return
    from send_push import send
    for odg in odgs:
        scenes = " · ".join(odg.get("scene_ids") or [])
        send(film, f"🎙 D{odg['day']:02d} lavs ready", f"Scenes {scenes} — tap to share the mic list (check the draft first)",
             f"./#lavs-{odg['day']}", tag=f"lavs-{odg['day']}", audience="owner")


def add_late_sides(film, other_sides):
    """The sides came in a later email than the ODG: make the ODG's proposal again with them,
    but only while Ana hasn't decided anything in it yet."""
    remade = []
    by_message = {}
    for email_folder in sorted((film / "_inbox").iterdir()):
        info = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
        by_message[info.get("message_id")] = email_folder
    for path in sorted((film / "proposals").glob("odg-*.json")):
        old = json.loads(path.read_text(encoding="utf-8"))
        email_folder = by_message.get(old["source"].get("message_id"))
        untouched = old["status"] == "open" and not old["decisions"]
        missing = any(w.startswith("No sides") for w in old["warnings"])
        if not (untouched and missing and email_folder and old["day"] in other_sides):
            continue
        proposal = build_proposal(film, email_folder, other_sides)
        proposal["id"], proposal["source"]["message_id"] = old["id"], old["source"]["message_id"]
        proposal["title"] += " + sides"
        write_json(path, proposal)
        remade.append(proposal)
        print(f"proposal {old['id']} made again with the sides: {len(proposal['changes'])} changes")
    return remade


def file_documents(film, other_sides):
    """Copy each ODG email's PDFs to docs/day-<n>/ and the sides' lines to lines/sides/
    (only when new or changed)."""
    import shutil
    from cue_lines import write_sides_lines
    from read_odg import read_odg
    changed = []
    for email_folder in sorted((film / "_inbox").iterdir()):
        odg = next((p for p in email_folder.glob("*.pdf") if "ODG" in p.name.upper()), None)
        if not odg:
            continue
        sheet = read_odg(odg)
        day = sheet["number"]
        sides = next((p for p in email_folder.glob("*.pdf") if "STRALCI" in p.name.upper()), None) \
            or other_sides.get(day)
        if sides:  # the lines of the day's scenes, for 🎙 Cues
            scene_ids = [s["scene_id"] for s in sheet["scenes"]]
            changed += [f"Cues of scene {sid} (sides)" for sid in write_sides_lines(film, sides, day, scene_ids)]
        for source, name in ((odg, "odg.pdf"), (sides, "sides.pdf")):
            if not source:
                continue
            target = film / "docs" / f"day-{day}" / name
            if not target.exists() or target.read_bytes() != source.read_bytes():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
                changed.append(f"day {day} {name}")
    changed += file_latest_pdl(film)
    changed += file_archive(film)
    changed += file_crew_calls(film)
    return changed


def file_crew_calls(film):
    """Everyone's call on each ODG → calls.json { "2026-10-12": { "Maria Rossi": "08:50", … } }.
    The alarms follow the call of the person Ana rides with (settings "commute" → "ride_with",
    Ana, 11 Oct); the app keeps Ana's own call everywhere else.
    Read from the filed ODGs (docs/day-<n>/odg.pdf, the newest of each day), after file_documents."""
    from read_crew import read_crew
    from read_odg import as_time, read_odg
    target = film / "calls.json"
    calls = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    for odg in sorted((film / "docs").glob("day-*/odg.pdf")):
        date = read_odg(odg)["date"]
        if not date:
            continue
        crew = {p["name"]: as_time(p["call"]) for p in read_crew(odg) if as_time(p["call"])}
        if crew:
            calls[date] = crew
    if target.exists() and json.loads(target.read_text(encoding="utf-8")) == calls:
        return []
    write_json(target, dict(sorted(calls.items())))
    return ["crew calls"]


def file_latest_pdl(film):
    """The newest PDL email's PDF → docs/pdl.pdf (+ docs/pdl.json: which email), for the app's
    Projects screen. The emails are in date order, so the last one found wins."""
    import shutil
    latest = None
    for email_folder in sorted((film / "_inbox").iterdir()):
        pdl = next((p for p in email_folder.glob("*.pdf") if "PDL" in p.name.upper()), None)
        if pdl:
            latest = (pdl, json.loads((email_folder / "email.json").read_text(encoding="utf-8")))
    if not latest:
        return []
    pdl, email = latest
    target = film / "docs" / "pdl.pdf"
    if target.exists() and target.read_bytes() == pdl.read_bytes():
        return []
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(pdl, target)
    write_json(film / "docs" / "pdl.json", {"subject": email["subject"], "received": email["date"], "file": pdl.name})
    return ["the latest PDL"]


def file_archive(film):
    """Official PDFs NOT already kept as a current copy (docs/day-<n>/odg.pdf, sides.pdf, docs/pdl.pdf):
    outdated or corrected ODGs and sides, older PDLs, scalette, maps… → docs/archive/<received>_<subject>_<id>/
    + email.json (Ana, 12 Oct: "the official docs should always be part of the database of the project,
    even the outdated ones" — "the ODG and the dailies scripts are already there, no need for duplicates").
    The robot re-downloads every email at each run, so a copy replaced in docs/day-<n>/ lands here at
    the next run. The app doesn't download the archive. Nothing here is ever deleted."""
    import shutil
    current = {p.read_bytes() for p in list((film / "docs").glob("day-*/*.pdf")) + [film / "docs" / "pdl.pdf"]
               if p.exists()}
    changed = []
    for email_folder in sorted((film / "_inbox").iterdir()):
        target = film / "docs" / "archive" / email_folder.name
        for source in sorted(email_folder.glob("*.pdf")):
            copy = target / source.name
            if copy.exists() or source.read_bytes() in current:
                continue
            target.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, copy)
            changed.append(f"archive {source.name}")
        if target.exists() and not (target / "email.json").exists():
            shutil.copyfile(email_folder / "email.json", target / "email.json")
    return changed


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if "--every-film" in sys.argv:
        repo = Path(sys.argv[sys.argv.index("--every-film") + 1])
        for film in sorted(p.parent for p in repo.glob("projects/*/inbox.json")):
            print(f"== {film.name}")
            run(film)
    else:
        run(sys.argv[1], include_past="--all" in sys.argv)
