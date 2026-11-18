"""test_read_lines_end_action.py — the action printed after a scene's last speech is kept for Dialogs → Whole scene
(pipeline/read_lines.py). The page is given as plain positioned lines. Names and text are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

import read_lines as reader  # noqa: E402

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


if __name__ == "__main__":
    unittest.main()
