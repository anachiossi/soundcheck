"""test_auto_presets.py — the robot's own preset review for the coming work days (pipeline/auto_presets.py).
A small made-up film is written into a temporary folder. Names and scenes are made up.
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from auto_presets import auto_review, coming_days  # noqa: E402
from odg_presets import first_presets_of_day  # noqa: E402

CAST = {"40": ["1", "2"], "50": ["1"], "60": ["2"]}


def said(*char_ids):
    return {"lines": [{"name": "x", "char_id": char_id, "text": "…"} for char_id in char_ids]}


def film_folder(settings_more=None, presets=None):
    """Day 5 (17 Nov): scene 40 + a 2nd unit · day 6 (18 Nov): scene 50, one unit · day 9 (30 Nov): scene 60."""
    folder = Path(tempfile.mkdtemp())
    files = {
        "settings.json": {"presets": {"protagonist": "1", "tx_order": ["1", "2"]}, **(settings_more or {})},
        "characters.json": [{"id": "1", "name": "ANNA"}, {"id": "2", "name": "BRUNO"}],
        "transmitters.json": [{"id": "1"}, {"id": "2"}],
        "lavaliers.json": [{"id": "L1", "model": "a"}, {"id": "L2", "model": "a"}],
        "schedule.json": [{"day": 5, "date": "2026-11-17", "scene_id": "40", "order": 1},
                          {"day": 5, "date": "2026-11-17", "scene_id": "90", "order": 1, "unit": "2nd"},
                          {"day": 6, "date": "2026-11-18", "scene_id": "50", "order": 1},
                          {"day": 9, "date": "2026-11-30", "scene_id": "60", "order": 1}],
        "lines/script/40.json": said("1"), "lines/script/50.json": said("1"),
    }
    for scene_id, rows in (presets or {}).items():
        files[f"presets/{scene_id}.json"] = {"scene_id": scene_id, "rows": rows}
    for name, content in files.items():
        (folder / name).parent.mkdir(parents=True, exist_ok=True)
        (folder / name).write_text(json.dumps(content), encoding="utf-8")
    (folder / "proposals").mkdir(exist_ok=True)
    return folder


class AutoPresets(unittest.TestCase):
    def test_the_scenes_of_the_coming_week_with_no_preset_get_a_review(self):
        folder = film_folder()
        proposal = auto_review(folder, today="2026-11-14", cast=CAST)
        self.assertEqual([c["scene_id"] for c in proposal["changes"]], ["40", "50"])  # not day 9: more than a week away
        self.assertEqual(proposal["title"], "Preset review · days 5, 6")
        self.assertEqual(proposal["changes"][0]["op"]["rows"], [
            {"char_id": "1", "tx_id": "1", "lav_id": "L1", "speaker": "yes"},
            {"char_id": "2", "tx_id": "", "lav_id": "", "speaker": "no"}])
        self.assertTrue((folder / "proposals" / f"{proposal['id']}.json").exists())

    def test_a_film_can_ask_for_the_days_with_a_2nd_unit_only(self):
        folder = film_folder({"commute": {"days": "days_with_2nd_unit"}})
        proposal = auto_review(folder, today="2026-11-14", cast=CAST)
        self.assertEqual([c["scene_id"] for c in proposal["changes"]], ["40"])

    def test_the_same_rows_are_never_offered_twice_and_new_rows_are(self):
        folder = film_folder()
        auto_review(folder, today="2026-11-14", cast=CAST)
        self.assertIsNone(auto_review(folder, today="2026-11-14", cast=CAST))
        # the sides of scene 40 arrive: BRUNO speaks after all
        (folder / "lines" / "sides").mkdir()
        (folder / "lines" / "sides" / "40.json").write_text(json.dumps(said("1", "2")), encoding="utf-8")
        again = auto_review(folder, today="2026-11-14", cast=CAST)
        self.assertEqual([c["scene_id"] for c in again["changes"]], ["40"])
        self.assertEqual(again["changes"][0]["id"], "c1")

    def test_nothing_is_written_when_every_coming_scene_has_a_preset_or_no_rules_are_set(self):
        rows = [{"char_id": "1", "tx_id": "1", "lav_id": "L1", "speaker": "yes"}]
        self.assertIsNone(auto_review(film_folder(presets={"40": rows, "50": rows}), today="2026-11-14", cast=CAST))
        without_rules = film_folder()
        (without_rules / "settings.json").write_text("{}", encoding="utf-8")
        self.assertIsNone(auto_review(without_rules, today="2026-11-14", cast=CAST))

    def test_days_already_shot_are_not_looked_at(self):
        film = {"settings": {}, "schedule": [{"day": 4, "date": "2026-11-13", "scene_id": "30", "order": 1},
                                             {"day": 5, "date": "2026-11-17", "scene_id": "40", "order": 1}]}
        self.assertEqual(coming_days(film, "2026-11-14"), [5])


class CallSheetFirstPresets(unittest.TestCase):
    def film(self, presets=None):
        return {"characters": [{"id": "1", "name": "ANNA"}, {"id": "2", "name": "BRUNO"}], "lines": {}, "sound": {},
                "presets": presets or {}, "transmitters": [{"id": "1"}, {"id": "2"}],
                "lavaliers": [{"id": "L1", "model": "a"}, {"id": "L2", "model": "a"}],
                "settings": {"presets": {"protagonist": "1", "tx_order": ["1", "2"]}}}

    def test_a_call_sheets_new_scene_gets_one_first_preset_with_the_sides_speakers(self):
        scenes = [{"scene_id": "40", "cast": ["1", "2"]}, {"scene_id": "90", "cast": ["2"], "unit": "2nd"}]
        found, notes = first_presets_of_day(self.film(), scenes, sides={"40": {"speakers": ["Bruno"]}})
        self.assertEqual(list(found), ["40"])  # the 2nd unit has its own sound team
        self.assertEqual(found["40"]["text"], "Scene 40: first preset (small day): ANNA TX 1, lav L1 (silent); "
                                              "BRUNO TX 2, lav L2 (speaks)")
        self.assertEqual(notes, [])

    def test_a_scene_with_a_preset_and_a_part_of_such_a_scene_are_left_to_the_proposal(self):
        rows = [{"char_id": "1", "tx_id": "1", "lav_id": "L1", "speaker": "yes"}]
        scenes = [{"scene_id": "40", "cast": ["1"]}, {"scene_id": "40pt1", "cast": ["1"]}, {"scene_id": "41", "cast": []}]
        found, _ = first_presets_of_day(self.film({"40": {"scene_id": "40", "rows": rows}}), scenes)
        self.assertEqual(found, {})


if __name__ == "__main__":
    unittest.main()
