"""cue_lines.py — writes the lines of each scene for the app's 🎙 Cues mode:
    projects/<film>/lines/sides/<scene>.json   from the latest sides with that scene
    projects/<film>/lines/script/<scene>.json  from the full script (the fallback)
    { scene_id, source: 'Sides · Day 6' | 'Script 21.08.26', heading,
      lines: [{ name, char_id, text }] }        char_id → the character's colour in the app
The full script PDF is also kept as docs/script.pdf (📄 in Kit, readable offline).

New script version (by hand, on the laptop):
    python pipeline/cue_lines.py <film folder> "<script.pdf>" "21.08.26"
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
        out.append({"name": line["name"], "char_id": char_id or "", "text": line["text"]})
    return out


def write_scene_files(folder, scenes, source, characters):
    """Returns the scene ids whose file is new or changed."""
    changed = []
    folder.mkdir(parents=True, exist_ok=True)
    for scene_id, scene in scenes.items():
        content = {"scene_id": scene_id, "source": source, "heading": scene["heading"],
                   "lines": with_characters(scene["lines"], characters)}
        text = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
        path = folder / f"{scene_id}.json"
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
            changed.append(scene_id)
    return changed


def characters_of(film):
    return json.loads((film / "characters.json").read_text(encoding="utf-8"))


def write_sides_lines(film, sides_pdf, day, scene_ids):
    scenes = read_lines(sides_pdf, scene_ids)
    return write_scene_files(Path(film) / "lines" / "sides", scenes, f"Sides · Day {day}", characters_of(Path(film)))


def write_script_lines(film, script_pdf, version):
    film = Path(film)
    scenes = read_lines(script_pdf)
    folder = film / "lines" / "script"
    for old in folder.glob("*.json") if folder.exists() else []:
        if old.stem not in scenes:  # a scene cut from the new version
            old.unlink()
    changed = write_scene_files(folder, scenes, f"Script {version}", characters_of(film))
    (film / "docs").mkdir(exist_ok=True)
    shutil.copyfile(script_pdf, film / "docs" / "script.pdf")
    (film / "docs" / "script.json").write_text(
        json.dumps({"version": version, "file": Path(script_pdf).name}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return scenes, changed


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    scenes, changed = write_script_lines(sys.argv[1], sys.argv[2], sys.argv[3])
    unknown = sorted({l["name"] for s in scenes.values() for l in s["lines"]
                      if not find_character(l["name"], characters_of(Path(sys.argv[1])))[0]})
    print(f"{len(scenes)} scenes, {sum(len(s['lines']) for s in scenes.values())} lines, {len(changed)} files written")
    print("speakers that are not characters (grey in Cues):", unknown or "none")
