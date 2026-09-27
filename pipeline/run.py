"""run.py — the whole morning check, in one go:
    1. download new production emails (fetch_mail.py)
    2. for each new email: an ODG of today or later (+ its sides) → proposals/odg-<n>.json
       (propose.py); a PDL (+ scaletta) → a whole review from today on → proposals/pdl-<date>.json
       (propose_pdl.py)
    3. file each ODG email's PDFs as projects/<film>/docs/day-<n>/odg.pdf and sides.pdf, so the
       app can open them offline (📄 buttons on each day)
    4. commit + push the new proposals and documents to the private data repo

Only proposals are written. The film's data changes only when Ana accepts them in the app.

    python pipeline/run.py D:/sound_check_data/projects/la-buona-educazione
    python pipeline/run.py <film folder> --all      (also days already shot, for testing)
    python pipeline/run.py --every-film <data repo> --evening
        every film with an inbox.json; --evening = only between 17:00 and midnight, Rome time
        (this is what GitHub Actions runs every 30 minutes: .github/workflows/emails.yml)
"""

import datetime
import json
import zoneinfo
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
    known = {json.loads(p.read_text(encoding="utf-8"))["source"]["subject"]: p.stem
             for p in proposals.glob("*.json")} if proposals.exists() else {}

    written = []
    for email_folder in sorted((film / "_inbox").iterdir()):
        info = json.loads((email_folder / "email.json").read_text(encoding="utf-8"))
        if info["subject"] in known:
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
            git(repo, "add", str(film / "docs"))
        titles = ", ".join([p["title"] for p in written] + ([f"{len(documents)} document(s)"] if documents else []))
        git(repo, "commit", "--quiet", "-m", f"From production emails: {titles}")
        git(repo, "push", "--quiet")
        print("pushed: the app will show them at the next sync")
    else:
        print("nothing new")
    return written


def file_documents(film):
    """Copy each ODG email's PDFs to docs/day-<n>/ (only when new or changed)."""
    import shutil
    from read_odg import read_odg
    changed = []
    for email_folder in sorted((film / "_inbox").iterdir()):
        odg = next((p for p in email_folder.glob("*.pdf") if "ODG" in p.name.upper()), None)
        if not odg:
            continue
        day = read_odg(odg)["number"]
        sides = next((p for p in email_folder.glob("*.pdf") if "STRALCI" in p.name.upper()), None)
        for source, name in ((odg, "odg.pdf"), (sides, "sides.pdf")):
            if not source:
                continue
            target = film / "docs" / f"day-{day}" / name
            if not target.exists() or target.read_bytes() != source.read_bytes():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
                changed.append(f"day {day} {name}")
    return changed


def is_evening_in_rome():
    return datetime.datetime.now(zoneinfo.ZoneInfo("Europe/Rome")).hour >= 17


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if "--every-film" in sys.argv:
        if "--evening" in sys.argv and not is_evening_in_rome():
            sys.exit("Not evening in Rome yet (17:00–24:00): nothing to do.")
        repo = Path(sys.argv[sys.argv.index("--every-film") + 1])
        for film in sorted(p.parent for p in repo.glob("projects/*/inbox.json")):
            print(f"== {film.name}")
            run(film)
    else:
        run(sys.argv[1], include_past="--all" in sys.argv)
