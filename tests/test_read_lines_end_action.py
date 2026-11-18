"""test_read_lines_end_action.py — the action printed after a scene's last speech is kept for Dialogs → Whole scene
(pipeline/read_lines.py). The page is given as plain positioned lines. Names and text are made up (this repo is public).
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

import read_lines as reader  # noqa: E402
from cue_lines import write_scene_files  # noqa: E402

PAGE = [(0, 10, 54, "1"), (0, 10, 108, "INT. CASA - GIORNO"), (0, 30, 108, "Anna entra."), (0, 50, 250, "ANNA"), (0, 62, 180, "Ciao."),
        (0, 80, 108, "Esce sbattendo"), (0, 92, 108, "la porta."),
        (0, 120, 54, "2"), (0, 120, 108, "EST. STRADA - NOTTE"), (0, 140, 250, "BRUNO"), (0, 152, 180, "Ehi.")]


class EndAction(unittest.TestCase):
    def scenes(self):
        with mock.patch.object(reader, "page_lines", return_value=PAGE):
            return reader.read_lines("any.pdf")

    def test_the_action_after_the_last_speech_stays_with_its_scene(self):
        self.assertEqual(self.scenes()["1"]["end_action"], "Esce sbattendo la porta.")

    def test_the_action_before_a_speech_stays_on_that_speech(self):
        self.assertEqual(self.scenes()["1"]["lines"][0]["action"], "Anna entra.")

    def test_a_scene_that_ends_on_a_speech_has_no_end_action(self):
        self.assertNotIn("end_action", self.scenes()["2"])


class FiledFilms(unittest.TestCase):
    scene = {"heading": "INT. CASA", "lines": [{"name": "ANNA", "text": "Ciao."}]}

    def film(self, film_folder, settings):
        (Path(film_folder) / "settings.json").write_text(json.dumps(settings), encoding="utf-8")
        return Path(film_folder) / "lines" / "sides"

    def test_a_film_that_did_not_ask_is_filed_byte_for_byte_as_before(self):
        with tempfile.TemporaryDirectory() as film_folder:
            folder = self.film(film_folder, {})
            write_scene_files(folder, {"1": self.scene}, "Sides", [])
            changed = write_scene_files(folder, {"1": {**self.scene, "end_action": "Esce."}}, "Sides", [])
            self.assertEqual(changed, [])
            self.assertNotIn("end_action", json.loads((folder / "1.json").read_text(encoding="utf-8")))

    def test_a_film_that_asks_gets_the_end_action(self):
        with tempfile.TemporaryDirectory() as film_folder:
            folder = self.film(film_folder, {"end_action": True})
            write_scene_files(folder, {"1": {**self.scene, "end_action": "Esce."}}, "Sides", [])
            self.assertEqual(json.loads((folder / "1.json").read_text(encoding="utf-8"))["end_action"], "Esce.")

    def test_a_changed_speech_is_still_written(self):
        with tempfile.TemporaryDirectory() as film_folder:
            folder = self.film(film_folder, {})
            write_scene_files(folder, {"1": self.scene}, "Sides", [])
            changed = write_scene_files(folder, {"1": {**self.scene, "lines": [{"name": "ANNA", "text": "Addio."}]}}, "Sides", [])
            self.assertEqual(changed, ["1"])


if __name__ == "__main__":
    unittest.main()
