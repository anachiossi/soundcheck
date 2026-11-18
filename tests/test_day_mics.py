"""test_day_mics.py — every ODG proposes the missing TX and lavs of its days (pipeline/day_mics.py).
Names and scenes are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from day_mics import mic_changes_of_day, rows_after, script_speakers  # noqa: E402


def row(char_id, tx_id="", lav_id="", speaker="yes"):
    return {"char_id": char_id, "tx_id": tx_id, "lav_id": lav_id, "speaker": speaker}


def film(presets, lines=None):
    return {"characters": [{"id": "1", "name": "ANNA"}, {"id": "2", "name": "BRUNO"}, {"id": "3", "name": "CARLA"}],
            "lines": lines or {}, "sound": {}, "transmitters": [{"id": "1"}, {"id": "2"}, {"id": "3"}],
            "lavaliers": [{"id": "L1", "model": "a"}, {"id": "L2", "model": "a"}, {"id": "L3", "model": "a"}],
            "presets": {scene: {"scene_id": scene, "rows": rows} for scene, rows in presets.items()},
            "settings": {"presets": {"protagonist": "1", "tx_order": ["1", "2", "3"]}}}


def scene(scene_id, cast=("1", "2"), **more):
    return {"scene_id": scene_id, "cast": list(cast), **more}


def said(*char_ids):
    return {"lines": [{"name": "x", "char_id": char_id, "text": "…"} for char_id in char_ids]}


def mics_of(changes):
    return {c["op"]["scene_id"]: c["op"]["mics"] for c in changes if c["op"]["op"] == "set_mics"}


class DayMics(unittest.TestCase):
    def test_a_scene_with_people_and_no_tx_gets_the_days_mics(self):
        changes, _ = mic_changes_of_day(film({"40": [row("1"), row("2")]}), [scene("40")], [])
        self.assertEqual(mics_of(changes), {"40": [{"char_id": "1", "tx_id": "1", "lav_id": "L1"},
                                                   {"char_id": "2", "tx_id": "2", "lav_id": "L2"}]})
        self.assertEqual(changes[0]["text"], "Scene 40 mics: ANNA TX 1, lav L1 (speaks); BRUNO TX 2, lav L2 (speaks)")

    def test_a_tx_already_chosen_is_never_changed_and_the_others_fit_around_it(self):
        changes, _ = mic_changes_of_day(film({"40": [row("1", "3", "L3"), row("2")]}), [scene("40")], [])
        self.assertEqual(mics_of(changes), {"40": [{"char_id": "2", "tx_id": "1", "lav_id": "L1"}]})

    def test_a_scene_with_every_mic_set_gets_no_change(self):
        changes, _ = mic_changes_of_day(film({"40": [row("1", "1", "L1")]}), [scene("40", ["1"])], [])
        self.assertEqual(changes, [])

    def test_someone_the_sheet_adds_gets_a_mic_and_someone_it_removes_does_not(self):
        earlier = [{"op": {"op": "add_row", "scene_id": "40", "row": row("3")}},
                   {"op": {"op": "remove_row", "scene_id": "40", "char_id": "2"}}]
        changes, _ = mic_changes_of_day(film({"40": [row("1", "1", "L1"), row("2")]}), [scene("40", ["1", "3"])], earlier)
        self.assertEqual([mic["char_id"] for mic in mics_of(changes)["40"]], ["3"])

    def test_a_silent_character_gets_no_mic_unless_the_rules_wire_them(self):
        silent = film({"40": [row("1"), row("2", speaker="no")]})
        changes, _ = mic_changes_of_day(silent, [scene("40")], [])
        self.assertEqual([mic["char_id"] for mic in mics_of(changes)["40"]], ["1"])
        silent["settings"]["presets"]["wire_silent"] = "recurring"
        changes, _ = mic_changes_of_day(silent, [scene("40")], [])
        self.assertEqual([mic["char_id"] for mic in mics_of(changes)["40"]], ["1", "2"])

    def test_the_2nd_unit_never_takes_this_kit(self):
        changes, _ = mic_changes_of_day(film({"90": [row("1")]}), [scene("90", ["1"], unit="2nd")], [])
        self.assertEqual(changes, [])

    def test_with_no_sides_the_script_says_who_speaks(self):
        changes, _ = mic_changes_of_day(film({"40": [row("1", speaker="maybe"), row("2", speaker="maybe")]},
                                             {"script/40": said("2")}), [scene("40")], [])
        self.assertEqual(changes[0]["op"], {"op": "set_speaker", "scene_id": "40", "char_id": "2", "speaker": "yes"})
        self.assertEqual(changes[0]["text"], "Scene 40: BRUNO speaks MAYBE → YES (script)")

    def test_the_sides_come_before_the_script(self):
        lines = {"sides/40": said("1"), "script/40": said("2")}
        self.assertEqual(script_speakers(film({}, lines), scene("40")), [])

    def test_a_script_scene_naming_someone_off_the_sheet_is_another_scene(self):
        self.assertEqual(script_speakers(film({}, {"script/40": said("1", "3")}), scene("40", ["1", "2"])), [])

    def test_a_character_given_a_number_by_the_sheet_keeps_their_row(self):
        presets = {"40": {"scene_id": "40", "rows": [row("c-lola")]}}
        after = rows_after(presets, [{"op": {"op": "number_character", "from": "c-lola", "character": {"id": "79"}}}])
        self.assertEqual(after["40"]["rows"][0]["char_id"], "79")
        self.assertEqual(presets["40"]["rows"][0]["char_id"], "c-lola", "the film itself is not changed")


if __name__ == "__main__":
    unittest.main()
