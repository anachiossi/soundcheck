"""test_read_odg_table.py — the call-sheet reader driven by a template of words (pipeline/read_odg_table.py,
odg_template.py) and the reading checks (pipeline/reading_checks.py). Tables are given as plain rows of cells,
the way the PDF library finds them. Names and scenes are made up (this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from odg_template import fields_named, template_for, DEFAULT_TEMPLATE  # noqa: E402
from pdf_tables import without_stray_letters  # noqa: E402
from read_odg_table import read_table_pages  # noqa: E402
from reading_checks import checked_reading, eighths, odg_problems, readings_differ, reading_warnings  # noqa: E402


def row(*cells):
    """cells = (x, 'text'): each cell is 40 wide."""
    return [{"x0": x, "x1": x + 40, "text": text} for x, text in cells]


HEADER = row((20, "SCENA"), (70, "I/E"), (120, "LUCE"), (170, "AMBIENTE"), (220, "SINOSSI"), (270, "ID"), (320, "PAG"))
LINES = ["ODG #7", "Lunedì 9 Novembre 2026", "CONVOCAZIONE", "08.00", "FINE LAVORAZIONE", "16.00"]


def sheet(*rows, lines=LINES, **more):
    """One page: the first six lines above the table, any others printed inside it."""
    return read_table_pages([{"lines": lines, "tables": [{"line": len(LINES), "rows": list(rows)}]}], **more)


def scene(number, cast="1, 2", pages="1/8"):
    return row((20, number), (70, "I"), (120, "G"), (170, "CASA ROSSI"), (220, "Anna parla."), (270, cast), (320, pages))


class TableReader(unittest.TestCase):
    def test_a_header_cell_can_name_two_columns(self):
        columns = DEFAULT_TEMPLATE["columns"]
        self.assertEqual(fields_named("SET / SINOSSI", columns), ["set", "synopsis"])
        self.assertEqual(fields_named("I-E / G-N", columns), ["int_ext", "light"])
        self.assertEqual(fields_named("Pag.", columns), ["pages"])
        self.assertEqual(fields_named("Trucco", columns), [])

    def test_a_film_adds_its_own_words_and_never_removes_the_shared_ones(self):
        template = template_for({"odg_template": {"columns": {"set": ["LUOGO"]}}})
        self.assertEqual(fields_named("LUOGO", template["columns"]), ["set"])
        self.assertEqual(fields_named("AMBIENTE", template["columns"]), ["set"])
        self.assertEqual(fields_named("LUOGO", DEFAULT_TEMPLATE["columns"]), [])

    def test_the_day_is_read_from_the_labels_and_the_table_under_its_header(self):
        odg = sheet(HEADER, scene("12"), scene("13A", cast="-", pages="1 2/8"), row((20, "TOT"), (320, "1 3/8")))
        self.assertEqual((odg["number"], odg["date"], odg["call"], odg["wrap"]), (7, "2026-11-09", "08:00", "16:00"))
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["12", "13A"])
        self.assertEqual(odg["scenes"][0], {"scene_id": "12", "story_day": "", "int_ext": "INT", "day_night": "G",
                                            "set": "CASA ROSSI", "synopsis": "Anna parla.", "cast": ["1", "2"],
                                            "pages": "1/8", "location": "", "standby": False})
        self.assertEqual(odg["scenes"][1]["cast"], [])
        self.assertEqual(odg["pages_total_printed"], "1 3/8")

    def test_one_column_holding_set_and_synopsis_is_split_at_the_first_line(self):
        header = row((20, "Scena"), (70, "I-E / G-N"), (170, "SET / SINOSSI"), (270, "CAST"), (320, "Pag."))
        odg = sheet(header, row((20, "27 fin"), (70, "I-E / N"), (170, "CASA ROSSI\nAnna parla\na lungo."), (270, "1"), (320, "2/8")))
        only = odg["scenes"][0]
        self.assertEqual((only["scene_id"], only["int_ext"], only["day_night"]), ("27fin", "INT/EXT", "N"))
        self.assertEqual((only["set"], only["synopsis"]), ("CASA ROSSI", "Anna parla a lungo."))

    def test_a_header_word_printed_in_pieces_is_put_together(self):
        header = row((20, "SCENA"), (70, "I"), (110, "-E / G-N"), (170, "SET/SINOSSI"), (320, "TI"), (360, "MELIN"), (400, "E"))
        odg = sheet(header, row((20, "5"), (70, "E / G"), (170, "PIAZZA\nUn mercato.")))
        self.assertEqual(odg["scenes"][0]["int_ext"], "EXT")

    def test_scene_numbers_stacked_in_one_cell_are_one_scene_each(self):
        odg = sheet(HEADER, scene("619\n626\n626CV", pages="1"), scene("136\nDRONE"))
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["619", "626", "626CV", "136DRONE"])
        self.assertEqual([s["pages"] for s in odg["scenes"]], ["1", "", "", "1/8"])

    def test_the_cast_table_inside_the_same_table_is_not_read_as_scenes(self):
        cast_header = row((20, "ID"), (70, "RUOLO"), (170, "ATTORE"), (270, "SCENE"))
        odg = sheet(HEADER, scene("12"), cast_header, row((20, "3"), (70, "Anna Rossi"), (170, "Maria Bianchi"), (270, "12")))
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["12"])
        self.assertEqual(odg["cast"], [{"id": "3", "role": "ANNA ROSSI", "actor": "Maria Bianchi"}])

    def test_the_scenes_after_the_next_day_announcement_are_tomorrows_and_a_second_one_is_not_read(self):
        odg = sheet(HEADER, scene("12"),
                    row((20, "PROGRAMMA DEL GIORNO SUCCESSIVO, MARTEDÌ 10 NOVEMBRE - ORARIO 09.00 - 17.00")), HEADER, scene("30"),
                    row((20, "PROGRAMMA DEL GIORNO SUCCESSIVO, MERCOLEDÌ 11 NOVEMBRE")), HEADER, scene("40"),
                    lines=LINES + ["12 I G CASA ROSSI", "PROGRAMMA DEL GIORNO SUCCESSIVO, MARTEDÌ 10 NOVEMBRE - ORARIO 09.00 - 17.00"])
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["12"])
        advance = odg["advance"]
        self.assertEqual([s["scene_id"] for s in advance["scenes"]], ["30"])
        self.assertEqual((advance["day"], advance["date"], advance["call"], advance["wrap"]), (8, "2026-11-10", "09:00", "17:00"))

    def test_two_units_the_film_says_which_is_the_main_one_whatever_the_order_printed(self):
        lines = ["ODG #7", "Lunedì 9 Novembre 2026", "CONVOCAZIONE UNITA’ VERDI", "10.30", "CONVOCAZIONE UNITA’ ROSSI", "17.00",
                 "FINE LAVORAZIONE UNITA’ VERDI", "18.30", "FINE LAVORAZIONE UNITA’ROSSI", "01.00"]
        odg = sheet(HEADER, row((20, "UNITÀ VERDI – orario 10:30 – 18:30")), scene("50"), row((20, "UNITA' ROSSI")), scene("60"),
                    lines=lines, main_unit="ROSSI")
        self.assertEqual((odg["call"], odg["wrap"]), ("17:00", "01:00"))
        self.assertEqual([(s["scene_id"], s.get("unit")) for s in odg["scenes"]], [("50", "2nd"), ("60", None)])
        self.assertEqual(odg["second_unit"], {"name": "Verdi", "call": "10:30", "wrap": "18:30"})
        self.assertEqual(odg["unit_warnings"], [])

    def test_a_watermark_letter_alone_on_a_line_is_dropped_from_a_cell(self):
        self.assertEqual(without_stray_letters("s\nProgramma del giorno"), "Programma del giorno")
        self.assertEqual(without_stray_letters("E"), "E")
        self.assertEqual(without_stray_letters("136\nDRONE"), "136\nDRONE")


class ReadingChecks(unittest.TestCase):
    def good(self, **changes):
        odg = sheet(HEADER, scene("12"), scene("13", pages="2/8"), row((20, "TOT"), (320, "3/8")))
        return {**odg, **changes}

    def test_pages_are_counted_in_eighths(self):
        self.assertEqual([eighths("1 3/8"), eighths("6/8"), eighths("2"), eighths("")], [11, 6, 16, None])

    def test_a_right_reading_has_no_problem(self):
        self.assertEqual(odg_problems(self.good()), [])

    def test_a_lost_scene_shows_in_the_pages_total(self):
        lost = self.good()
        lost["scenes"] = lost["scenes"][:1]
        self.assertIn("add up to 1/8, the sheet prints a total of 3/8", " ".join(odg_problems(lost)))

    def test_no_scenes_no_date_and_a_scene_twice_are_problems(self):
        self.assertIn("no scene was read for the day", odg_problems(self.good(scenes=[])))
        self.assertIn("no date was read", odg_problems(self.good(date="")))
        twice = self.good()
        twice["scenes"] = twice["scenes"] + twice["scenes"][:1]
        self.assertIn("scene 12 was read more than once", odg_problems(twice))

    def test_a_cast_number_missing_from_the_cast_list_is_a_problem(self):
        problems = odg_problems(self.good(cast=[{"id": "1", "role": "ANNA", "actor": ""}]))
        self.assertEqual(problems, ["cast number 2 is in a scene but not in the sheet's cast list"])

    def test_two_readers_that_disagree_say_where(self):
        own, other = self.good(), self.good(call="09:00")
        own["scenes"] = own["scenes"][:1]
        other["scenes"][0] = {**other["scenes"][0], "cast": ["1", "2", "7"]}
        self.assertEqual(readings_differ(own, other), [
            "call: read as 08:00, the second reader reads 09:00",
            "today: the second reader also sees scene 13",
            "scene 12: cast 1, 2, the second reader reads 1, 2, 7"])
        self.assertEqual(readings_differ(self.good(), self.good()), [])

    def test_the_warnings_never_stop_the_robot_when_the_second_reader_fails(self):
        def broken(_pdf):
            raise ValueError("not a PDF")
        own = {**self.good(), "reader": "main"}
        self.assertEqual(reading_warnings(own, "x.pdf", {}, second_reader=broken), [])
        lines = reading_warnings(own, "x.pdf", {}, second_reader=lambda _pdf: self.good(wrap="20:00"))
        self.assertEqual(lines, ["⚠ Two readers disagree — look at the PDF. wrap: read as 16:00, the second reader reads 20:00."])


    def test_a_reading_with_no_scene_takes_the_second_readers_scenes_and_says_so(self):
        empty = {**self.good(scenes=[]), "reader": "main"}
        odg, lines = checked_reading(empty, "x.pdf", {}, second_reader=lambda _pdf: self.good())
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["12", "13"])
        self.assertEqual(lines, ["⚠ The film's reader read no scene on this sheet: the scenes here were read by the "
                                 "second reader (12 · 13). Check them against the PDF."])

    def test_a_reading_with_scenes_is_never_replaced(self):
        own = {**self.good(), "reader": "main"}
        own["scenes"] = own["scenes"][:1]
        odg, lines = checked_reading(own, "x.pdf", {}, second_reader=lambda _pdf: self.good())
        self.assertEqual([s["scene_id"] for s in odg["scenes"]], ["12"])
        self.assertIn("⚠ Two readers disagree — look at the PDF. today: the second reader also sees scene 13.", lines)


if __name__ == "__main__":
    unittest.main()
