"""test_first_presets.py — the first mic rows of a scene with no preset (pipeline/first_presets.py) and the
preset review that gives them a TX and a lav (pipeline/propose_presets.py). Names and scenes are made up.
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from first_presets import first_rows  # noqa: E402
from propose_presets import review  # noqa: E402


def film(lines=None, cast=None, presets=None):
    characters = [{"id": "1", "name": "ANNA", "gender": "F"}, {"id": "2", "name": "BRUNO", "gender": "M"},
                  {"id": "3", "name": "CARLA", "gender": "F"}, {"id": "c-dora", "name": "DORA"}, {"id": "c-radio", "name": "RADIO", "off_set": True}]
    return {"characters": characters, "lines": lines or {}, "cast": cast or {}, "presets": presets or {}, "sound": {},
            "accepted": {}, "transmitters": [{"id": "1"}, {"id": "2"}, {"id": "3"}],
            "lavaliers": [{"id": "L1", "model": "cos11"}, {"id": "L2", "model": "6060"}, {"id": "L3", "model": "cos11"}],
            "schedule": [{"day": 5, "date": "2026-11-17", "scene_id": "40", "order": 1},
                         {"day": 5, "date": "2026-11-17", "scene_id": "41", "order": 2},
                         {"day": 5, "date": "2026-11-17", "scene_id": "90", "order": 1, "unit": "2nd"}],
            "settings": {"presets": {"protagonist": "1", "tx_order": ["1", "2", "3"],
                                     "lav_rules": {"by_gender": {"F": "cos11", "M": "6060"}}}}}


def said(*char_ids):
    return {"lines": [{"name": "x", "char_id": char_id, "text": "…"} for char_id in char_ids]}


class FirstRows(unittest.TestCase):
    def test_the_printed_cast_gets_a_row_each_and_speaks_yes_only_with_lines(self):
        rows, notes = first_rows(film({"script/40": said("1", "1")}), "40", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "yes"), ("2", "no")])
        self.assertEqual(notes, [])

    def test_the_sides_of_the_day_win_over_the_script(self):
        lines = {"script/40": said("1"), "sides/40": said("2")}
        rows, _ = first_rows(film(lines), "40", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "no"), ("2", "yes")])

    def test_with_no_lines_filed_nobody_knows_who_speaks(self):
        rows, notes = first_rows(film(), "40", ["1", "2"])
        self.assertEqual([r["speaker"] for r in rows], ["maybe", "maybe"])
        self.assertEqual(notes, ["Scene 40: no lines filed (no sides, not found in the script): who speaks is not known"])

    def test_a_small_part_with_lines_outside_the_printed_cast_gets_a_row_and_a_line_for_ana(self):
        rows, notes = first_rows(film({"script/40": said("1", "c-dora", "c-radio")}), "40", ["1"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "yes"), ("c-dora", "yes")])  # not the radio
        self.assertEqual(notes, ["Scene 40: DORA has lines but is not in the printed cast"])

    def test_script_lines_spoken_by_a_numbered_character_outside_the_printed_cast_are_not_trusted(self):
        rows, notes = first_rows(film({"script/40": said("2", "3")}), "40", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "maybe"), ("2", "maybe")])
        self.assertEqual(notes, ["Scene 40: in the script CARLA speaks here, but the printed cast does not list them: "
                                 "the script's scene may be another one. Who speaks is not known"])

    def test_the_sides_are_trusted_even_when_they_add_a_numbered_character(self):
        rows, _ = first_rows(film({"sides/40": said("2", "3")}), "40", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "no"), ("2", "yes"), ("3", "yes")])

    def test_a_part_of_a_scene_with_only_the_whole_scenes_lines_is_a_guess(self):
        rows, notes = first_rows(film({"script/40": said("1", "c-dora")}), "40A", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "yes"), ("2", "maybe")])
        self.assertEqual(notes, ["Scene 40A: no lines of its own, only those of the whole scene: who speaks is a guess"])

    def test_a_sides_only_film_never_reads_the_script(self):
        data = film({"script/40": said("1", "2")})
        data["settings"]["lines"] = "sides_only"
        rows, notes = first_rows(data, "40", ["1", "2"])
        self.assertEqual([r["speaker"] for r in rows], ["maybe", "maybe"])
        self.assertEqual(notes, ["Scene 40: no sides yet: who speaks is not known"])

    def test_sides_that_print_the_scene_with_no_dialogue_mean_nobody_speaks(self):
        data = film({"sides/40B": {"lines": []}, "sides/40": said("1")})
        data["settings"]["lines"] = "sides_only"
        rows, notes = first_rows(data, "40B", ["1", "2"])
        self.assertEqual([r["speaker"] for r in rows], ["no", "no"])
        self.assertEqual(notes, [])

    def test_a_part_like_40Cfine_reads_the_part_the_sides_print(self):
        data = film({"sides/40C": said("2"), "sides/40": said("1")})
        rows, notes = first_rows(data, "40Cfine", ["1", "2"])
        self.assertEqual([(r["char_id"], r["speaker"]) for r in rows], [("1", "maybe"), ("2", "yes")])
        self.assertEqual(notes, ["Scene 40Cfine: no lines of its own, only those of the whole scene: who speaks is a guess"])

    def test_a_cast_number_that_is_no_character_yet_is_said(self):
        _, notes = first_rows(film({"script/40": said("1")}), "40", ["1", "77"])
        self.assertEqual(notes, ["Scene 40: cast number 77 is not a character of the film yet"])


class ReviewOfNewScenes(unittest.TestCase):
    def test_a_scene_with_no_preset_gets_its_first_one_with_the_days_tx_and_lav(self):
        data = film({"script/40": said("1", "2"), "script/41": said("2")}, cast={"40": ["1", "2"], "41": ["2", "3"]})
        changes, warnings = review(data, 5)
        self.assertEqual([c["scene_id"] for c in changes], ["40", "41"])
        self.assertEqual(changes[0]["text"], "Day 5 · scene 40: first preset (small day): "
                                             "ANNA TX 1, lav L1 (speaks); BRUNO TX 2, lav L2 (speaks)")
        self.assertEqual(changes[1]["op"]["rows"], [
            {"char_id": "2", "tx_id": "2", "lav_id": "L2", "speaker": "yes"},   # the same TX and lav all day
            {"char_id": "3", "tx_id": "", "lav_id": "", "speaker": "no"}])        # silent: a row, no mic
        self.assertEqual(warnings, [])

    def test_the_2nd_units_scenes_and_scenes_with_no_printed_cast_are_left_alone(self):
        data = film({"script/40": said("1")}, cast={"40": ["1"], "90": ["2"]})
        changes, warnings = review(data, 5)
        self.assertEqual([c["scene_id"] for c in changes], ["40"])
        self.assertEqual(warnings, ["Scene 41: no preset (who is in the scene?)"])

    def test_a_scene_that_has_a_preset_keeps_its_people(self):
        before = {"40": {"scene_id": "40", "rows": [{"char_id": "1", "tx_id": "1", "lav_id": "L1", "speaker": "yes"}]}}
        data = film({"script/40": said("1", "2")}, cast={"40": ["1", "2"], "41": []}, presets=before)
        changes, _ = review(data, 5)
        self.assertEqual(changes, [])


class GenderFromTheActorsName(unittest.TestCase):
    def test_a_known_first_name_or_an_italian_ending_gives_the_gender_and_anything_else_nothing(self):
        from name_gender import gender_from_actor
        self.assertEqual([gender_from_actor(name) for name in ("Anna Rossi", "Nicola Verdi", "Andrea Neri", "Ornella Blu",
                                                               "Renato Gialli", "Kim Lee", "")],
                         ["F", "M", "M", "F", "M", "", ""])

    def test_a_call_sheet_offers_the_gender_only_to_a_film_that_asks_and_a_character_without_one(self):
        from compare import check_cast_list
        characters = [{"id": "1", "name": "ANNA", "actor": "Anna Rossi"}, {"id": "2", "name": "BRUNO", "actor": "Nicola Verdi", "gender": "M"}]
        cast = [{"id": "1", "role": "ANNA", "actor": "Anna Rossi"}, {"id": "2", "role": "BRUNO", "actor": "Nicola Verdi"},
                {"id": "3", "role": "CARLA", "actor": "Ornella Blu"}]
        changes, _, _ = check_cast_list(cast, characters, predict_gender=True)
        self.assertEqual([c["text"] for c in changes], [
            "ANNA: gender → F (from the actor's name, Anna Rossi)",
            "New character 3 CARLA (Ornella Blu, gender F from the actor's name)"])
        self.assertEqual(changes[1]["op"]["character"]["gender"], "F")
        changes, _, _ = check_cast_list(cast, characters)
        self.assertEqual([c["text"] for c in changes], ["New character 3 CARLA (Ornella Blu)"])


if __name__ == "__main__":
    unittest.main()
