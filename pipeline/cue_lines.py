"""cue_lines.py — writes the lines of each scene for the app's 🎙 Cues mode:
    projects/<film>/lines/sides/<scene>.json   from the latest sides with that scene
    projects/<film>/lines/script/<scene>.json  from the full script (the fallback)
    { scene_id, source: 'Sides · Day 6' | 'Script 21.08.26', heading,
      lines: [{ name, char_id, text, action? }] }  char_id → the character's colour; action = what happens before
The full script PDF is also kept as docs/script.pdf (📄 in Kit, readable offline).

New script version (by hand, on the laptop):
    python pipeline/cue_lines.py <film folder> "<script.pdf>" "21.08.26"
A series, one PDF per episode (→ docs/scripts/ep2.pdf; each scene file also keeps "pdf" + "page"):
    python pipeline/cue_lines.py <film folder> "<LA LISTA_EP2….pdf>" "REV.5 17.08.26" --episode 2
Sides: run.py calls write_sides_lines() for every ODG email that has sides.
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from compare import find_character  # noqa: E402
from read_lines import read_lines  # noqa: E402


def with_characters(lines, characters):
    out = []
    for line in lines:
        char_id, _ = find_character(line["name"], characters)
        out.append({"name": line["name"], "char_id": char_id or "", "text": line["text"],
                    **({"action": line["action"]} if line.get("action") else {})})
    return out


def write_scene_files(folder, scenes, source, characters):
    """Returns the scene ids whose file is new or changed."""
    changed = []
    folder.mkdir(parents=True, exist_ok=True)
    for scene_id, scene in scenes.items():
        content = {"scene_id": scene_id, "source": source, "heading": scene["heading"],
                   **({"pdf": scene["pdf"], "page": scene["page"]} if scene.get("pdf") else {}),
                   "lines": with_characters(scene["lines"], characters)}
        text = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
        path = folder / f"{scene_id}.json"
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
            changed.append(scene_id)
    return changed


def characters_of(film):
    return json.loads((film / "characters.json").read_text(encoding="utf-8"))


def reader_options(film):
    """The film's own script-reader options (settings.json → "script_reader"); none = the default reader."""
    settings = Path(film) / "settings.json"
    return json.loads(settings.read_text(encoding="utf-8")).get("script_reader", {}) if settings.exists() else {}


def write_sides_lines(film, sides_pdf, day, scene_ids):
    scenes = read_lines(sides_pdf, scene_ids, reader_options(film))
    return write_scene_files(Path(film) / "lines" / "sides", scenes, f"Sides · Day {day}", characters_of(Path(film)))


def scene_pages(script_pdf):
    """{scene id: page number (1 = first)} where each scene starts in the PDF (the 📄 Script button opens there)."""
    from read_sides import page_lines, SCENE_X, SCENE_ID_RE
    pages = {}
    for page, y, x, text in page_lines(script_pdf):
        if SCENE_X[0] <= x <= SCENE_X[1] and SCENE_ID_RE.match(text):
            pages.setdefault(text, page + 1)
    return pages


def write_script_lines(film, script_pdf, version, episode=None):
    """One script → lines/script/<scene>.json. A series (episode = 2): the PDF is docs/scripts/ep2.pdf and only
    that episode's old scenes can be removed — loading episode 2 never touches episode 1 (Il colpo, 3 Nov)."""
    film = Path(film)
    scenes = read_lines(script_pdf, options=reader_options(film))
    pdf_path = f"docs/scripts/ep{episode}.pdf" if episode else "docs/script.pdf"
    source = f"Script Ep{episode} {version}" if episode else f"Script {version}"
    pages = scene_pages(script_pdf)
    for scene_id, scene in scenes.items():  # where the scene is in the official script, for the 📄 button
        if scene_id in pages:
            scene["pdf"], scene["page"] = pdf_path, pages[scene_id]
    folder = film / "lines" / "script"
    for old in folder.glob("*.json") if folder.exists() else []:
        mine = not episode or json.loads(old.read_text(encoding="utf-8")).get("source", "").startswith(f"Script Ep{episode} ")
        if mine and old.stem not in scenes:  # a scene cut from the new version (of this episode)
            old.unlink()
    changed = write_scene_files(folder, scenes, source, characters_of(film))
    (film / pdf_path).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(script_pdf, film / pdf_path)
    about = film / "docs" / "script.json"
    info = json.loads(about.read_text(encoding="utf-8")) if about.exists() and episode else {}
    if episode:
        info.setdefault("episodes", {})[str(episode)] = {"version": version, "file": Path(script_pdf).name, "pdf": pdf_path}
    else:
        info = {"version": version, "file": Path(script_pdf).name}
    about.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return scenes, changed


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    episode = int(sys.argv[sys.argv.index("--episode") + 1]) if "--episode" in sys.argv else None
    scenes, changed = write_script_lines(sys.argv[1], sys.argv[2], sys.argv[3], episode)
    unknown = sorted({l["name"] for s in scenes.values() for l in s["lines"]
                      if not find_character(l["name"], characters_of(Path(sys.argv[1])))[0]})
    print(f"{len(scenes)} scenes, {sum(len(s['lines']) for s in scenes.values())} lines, {len(changed)} files written")
    print("speakers that are not characters (grey in Cues):", unknown or "none")
