"""test_sound_analysis.py — the first sound analysis (pipeline/sound_analysis.py), a new ODG's 2nd unit in the schedule
(pipeline/second_unit_days.py) and the rule "every actor has a mic" (presets.py, day_mics.py, auto_presets.py).
Names and scenes are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from auto_presets import auto_review, one_mic_each  # noqa: E402
from day_mics import mic_changes_of_day  # noqa: E402
from presets import gets_mic  # noqa: E402
from second_unit_days import add_second_unit_days  # noqa: E402
from sound_analysis import analyse, missing_analysis, script_actions  # noqa: E402

PEOPLE = [{"id": "1", "name": "ANNA"}, {"id": "2", "name": "BRUNO"}]


def film_folder(files):
    folder = Path(tempfile.mkdtemp())
    for name, content in files.items():
        (folder / name).parent.mkdir(parents=True, exist_ok=True)
        (folder / name).write_text(json.dumps(content), encoding="utf-8")
    return folder


class Analysis(unittest.TestCase):
    def test_the_words_of_the_action_become_flags_and_the_sentence_is_kept(self):
        found = analyse("Anna entra in piscina. Il cane abbaia.", PEOPLE)
        self.assertEqual(found["flags"], ["water", "animal"])
        self.assertIn("water: Anna entra in piscina.", found["notes"])

    def test_a_word_inside_another_word_is_not_a_flag(self):
        self.assertEqual(analyse("Bruno sparisce nella scena. Automaticamente si ferma.", PEOPLE)["flags"], [])

    def test_the_one_character_who_screams_gets_a_loud_warning(self):
        warnings = analyse("Bruno urla contro il muro.", PEOPLE)["warnings"]
        self.assertEqual([(w["char_id"], w["kind"]) for w in warnings], [("2", "loud")])

    def test_a_scream_with_two_characters_names_nobody(self):
        self.assertEqual(analyse("Anna e Bruno urlano.", PEOPLE)["warnings"], [])

    def test_a_scene_number_printed_in_small_letters_is_the_productions_scene(self):
        page = [(0, 10, 54, "526a"), (0, 30, 108, "Il cane abbaia.")]
        with mock.patch("sound_analysis.page_lines", return_value=page):
            self.assertEqual(script_actions("any.pdf"), {"526A": "Il cane abbaia."})

    def test_the_review_never_touches_the_day_being_shot(self):
        folder = film_folder({"settings.json": {"presets": {"wire_silent": "cast", "tx_order": ["1"]}}, "characters.json": PEOPLE,
                              "transmitters.json": [{"id": "1"}], "lavaliers.json": [{"id": "L1"}],
                              "schedule.json": [{"day": 2, "date": "2026-11-20", "scene_id": "20", "order": 1}]})
        (folder / "proposals").mkdir()
        self.assertIsNone(auto_review(folder, today="2026-11-20", cast={"20": ["1"]}))

    def test_someone_who_only_hears_the_screams_is_not_loud(self):
        self.assertEqual(analyse("Bruno, fuori dalla porta, sente quelle urla.", PEOPLE)["warnings"], [])

    def test_a_public_phone_is_not_a_crowd_and_the_public_is(self):
        self.assertEqual(analyse("Inquadra il telefono pubblico.", PEOPLE)["flags"], [])
        self.assertEqual(analyse("Vociare del pubblico.", PEOPLE)["flags"], ["crowd"])

    def files(self, **more):
        return {"settings.json": {"sound_analysis": True}, "characters.json": PEOPLE, "schedule.json": [],
                "scenes.json": {"40": {"synopsis": "Anna mangia."}}, **more}

    def test_a_film_that_did_not_ask_gets_nothing(self):
        folder = film_folder({**self.files(), "settings.json": {}})
        self.assertEqual(missing_analysis(folder, cast={}, actions={}), [])

    def test_a_scene_gets_its_file_with_no_level_and_a_file_already_there_stays(self):
        mine = {"scene_id": "41", "level": 5}
        folder = film_folder(self.files(**{"sound/41.json": mine}))
        self.assertEqual(missing_analysis(folder, cast={}, actions={"40": "Il cane abbaia.", "41": "Piove."}), ["40"])
        written = json.loads((folder / "sound" / "40.json").read_text(encoding="utf-8"))
        self.assertEqual(written["flags"], ["eating", "animal"])
        self.assertNotIn("level", written)
        self.assertEqual(json.loads((folder / "sound" / "41.json").read_text(encoding="utf-8")), mine)

    def test_a_script_scene_with_someone_the_pdl_does_not_print_is_read_from_the_pdl(self):
        folder = film_folder(self.files(**{"lines/script/40.json": {"lines": [{"char_id": "2"}]}}))
        missing_analysis(folder, cast={"40": ["1"]}, actions={"40": "Il cane abbaia."})
        written = json.loads((folder / "sound" / "40.json").read_text(encoding="utf-8"))
        self.assertEqual(written["flags"], ["eating"])
        self.assertIn("From the PDL", written["reason"])


class SecondUnitDays(unittest.TestCase):
    change = {"op": {"op": "set_day_scenes", "day": 7, "unit": "2nd", "scene_ids": ["90", "91"],
                     "fields": {"date": "2026-11-19", "week": 2, "unit_name": "Splinter"}}}

    def folder(self, days="days_with_2nd_unit", schedule=None):
        return film_folder({"settings.json": {"commute": {"days": days}}, "schedule.json": schedule or [{"day": 7, "date": "2026-11-19", "scene_id": "40"}]})

    def test_a_new_odgs_2nd_unit_is_in_the_schedule_at_once(self):
        folder = self.folder()
        self.assertTrue(add_second_unit_days(folder, {"changes": [self.change]}))
        rows = json.loads((folder / "schedule.json").read_text(encoding="utf-8"))
        self.assertEqual([(r["scene_id"], r.get("unit"), r.get("unit_name")) for r in rows],
                         [("40", None, None), ("90", "2nd", "Splinter"), ("91", "2nd", "Splinter")])

    def test_a_date_that_has_a_2nd_unit_is_left_alone(self):
        folder = self.folder(schedule=[{"day": 7, "date": "2026-11-19", "scene_id": "80", "unit": "2nd"}])
        self.assertFalse(add_second_unit_days(folder, {"changes": [self.change]}))

    def test_a_film_with_alarms_on_every_day_is_left_alone(self):
        self.assertFalse(add_second_unit_days(self.folder("all"), {"changes": [self.change]}))


def row(char_id, tx_id="", lav_id="", speaker="yes"):
    return {"char_id": char_id, "tx_id": tx_id, "lav_id": lav_id, "speaker": speaker}


class EveryActorHasAMic(unittest.TestCase):
    def film(self, presets=None, lines=None):
        return {"characters": [{"id": "1", "name": "ANNA"}, {"id": "2", "name": "BRUNO"}, {"id": "136", "name": "BIDELLA", "special_extra": True},
                               {"id": "c-voce", "name": "VOCE"}, {"id": "9", "name": "RADIO", "off_set": True}],
                "lines": lines or {}, "sound": {}, "transmitters": [{"id": "1"}, {"id": "2"}, {"id": "3"}],
                "lavaliers": [{"id": "L1", "model": "a"}, {"id": "L2", "model": "a"}, {"id": "L3", "model": "a"}],
                "presets": presets or {}, "settings": {"presets": {"wire_silent": "cast", "tx_order": ["1", "2", "3"]}}}

    def test_a_silent_actor_is_wired_and_a_special_extra_is_not(self):
        film = self.film()
        self.assertTrue(gets_mic(film, "40", row("2", speaker="no")))
        self.assertFalse(gets_mic(film, "40", row("136", speaker="no")))
        self.assertFalse(gets_mic(film, "40", row("c-voce", speaker="no")))

    def test_an_extra_printed_only_as_a_number_gets_no_mic(self):
        self.assertFalse(gets_mic(self.film(), "40", row("151", speaker="maybe")))

    def test_one_lav_on_two_people_is_put_right_for_the_whole_day(self):
        presets = {"40": {"scene_id": "40", "rows": [row("1", "1", "L1")]}, "41": {"scene_id": "41", "rows": [row("2", "2", "L1")]}}
        film = self.film(presets)
        self.assertEqual(one_mic_each(film, presets, ["40", "41"]), ["41"])
        self.assertEqual((presets["40"]["rows"][0]["lav_id"], presets["41"]["rows"][0]["lav_id"]), ("L1", "L2"))

    def test_an_extra_holding_an_actors_mic_gives_it_back(self):
        presets = {"40": {"scene_id": "40", "rows": [row("1", "1", "L1")]}, "41": {"scene_id": "41", "rows": [row("151", "1", "L2", "maybe")]}}
        one_mic_each(self.film(presets), presets, ["40", "41"])
        self.assertEqual((presets["41"]["rows"][0]["tx_id"], presets["41"]["rows"][0]["lav_id"]), ("", ""))

    def test_with_no_sides_every_printed_actor_speaks_and_gets_a_mic(self):
        changes, _ = mic_changes_of_day(self.film(), [{"scene_id": "40", "cast": ["1", "2", "136"]}], [])
        added = [c["op"]["row"] for c in changes if c["op"]["op"] == "add_row"]
        self.assertEqual([(r["char_id"], r["speaker"]) for r in added], [("1", "yes"), ("2", "yes")])
        mics = next(c["op"]["mics"] for c in changes if c["op"]["op"] == "set_mics")
        self.assertEqual([m["char_id"] for m in mics], ["1", "2"])

    def test_the_sides_still_say_who_is_silent(self):
        lines = {"sides/40": {"lines": [{"char_id": "1"}]}}
        changes, _ = mic_changes_of_day(self.film(lines=lines), [{"scene_id": "40", "cast": ["1", "2"]}], [])
        self.assertEqual({c["op"]["row"]["char_id"]: c["op"]["row"]["speaker"] for c in changes if c["op"]["op"] == "add_row"}, {"1": "yes", "2": "no"})

    def test_the_review_covers_every_day_still_to_shoot_and_is_not_offered_twice(self):
        settings = {"presets": {"wire_silent": "cast", "tx_order": ["1", "2"]}}
        folder = film_folder({"settings.json": settings, "characters.json": PEOPLE, "transmitters.json": [{"id": "1"}, {"id": "2"}],
                              "lavaliers.json": [{"id": "L1"}, {"id": "L2"}],
                              "schedule.json": [{"day": 1, "date": "2026-11-01", "scene_id": "10", "order": 1},
                                                {"day": 2, "date": "2026-11-20", "scene_id": "20", "order": 1},
                                                {"day": 30, "date": "2027-02-01", "scene_id": "30", "order": 1}]})
        (folder / "proposals").mkdir()
        cast = {"10": ["1"], "20": ["1", "2"], "30": ["2"]}
        proposal = auto_review(folder, today="2026-11-19", cast=cast)
        self.assertEqual([c["scene_id"] for c in proposal["changes"]], ["20", "30"])
        self.assertEqual([(r["char_id"], r["tx_id"], r["speaker"]) for r in proposal["changes"][0]["op"]["rows"]], [("1", "1", "yes"), ("2", "2", "yes")])
        self.assertIsNone(auto_review(folder, today="2026-11-19", cast=cast))


if __name__ == "__main__":
    unittest.main()
