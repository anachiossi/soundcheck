"""run.py — the whole morning check, in one go:
    1. download new production emails (fetch_mail.py)
    2. for each new email: an ODG of today or later (+ its sides) → proposals/odg-<n>.json
       (propose.py); a PDL (+ scaletta) → a whole review from today on → proposals/pdl-<date>.json
       (propose_pdl.py)
    3. file each ODG email's PDFs as projects/<film>/docs/day-<n>/odg.pdf and sides.pdf, so the
       app can open them offline (📄 buttons on each day), and the sides' lines for 🎙 Cues
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
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_mail import fetch  # noqa: E402
from propose import build_proposal  # noqa: E402
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
    for email_folder in sorted((film / "_inbox").iterdir()):
        info = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
        if info.get("message_id") in known or info["subject"] in known:
            continue
        names = " ".join(info["files"]).upper()
        if "PDL" in names:
            proposal = build_pdl_proposal(film, email_folder)
        elif "ODG" in names:
            proposal = build_proposal(film, email_folder)
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

    documents = file_documents(film)
    if documents:
        print(f"documents: {', '.join(documents)}")
    if written or documents:
        if written:
            git(repo, "add", str(proposals))
        if documents:
            git(repo, "add", str(film / "docs"), str(film / "lines"))
        titles = ", ".join([p["title"] for p in written] + ([f"{len(documents)} document(s)"] if documents else []))
        git(repo, "commit", "--quiet", "-m", f"From production emails: {titles}")
        git(repo, "push", "--quiet")
        print("pushed: the app will show them at the next sync")
    else:
        print("nothing new")
    return written


def file_documents(film):
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
        sides = next((p for p in email_folder.glob("*.pdf") if "STRALCI" in p.name.upper()), None)
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
