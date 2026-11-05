"""test_read_odg_lux_vide.py — the ODG and crew readers for Lux Vide's layout (pipeline/read_odg_lux_vide.py,
read_crew_lux_vide.py), with words placed where those PDFs print them (x, y). Names and scenes are made up
(this repo is public).
Run (from the repo folder):
    python3 -m unittest discover -s tests -p "test_*.py"
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))

from compare_crew import find_person  # noqa: E402
from read_crew_lux_vide import read_crew_lines  # noqa: E402
from read_odg_lux_vide import read_lux_vide  # noqa: E402


def row(y, *cells):
    """cells = (x, 'text'): one printed line each; their words, placed one after the other."""
    lines = [(y, x, text) for x, text in cells]
    words = []
    for x, text in cells:
        for word in text.split():
            words.append((y, x, word))
            x += 6 * len(word) + 3
    return words, lines


def page(*rows):
    words, lines = [], []
    for w, l in rows:
        words += w
        lines += l
    return sorted(words), sorted(lines)


FIRST = page(
    row(60, (34, "ODG #12")), row(70, (34, "Martedì, 3 Novembre 2026")),
    row(100, (34, "Convocazione troupe:")), row(110, (34, "07.30")),
    row(120, (34, "Pronti a girare:")), row(130, (34, "08.00")),
    row(140, (34, "Fine Riprese:")), row(150, (34, "Fine Lavorazione:")), row(160, (34, "17.30")), row(170, (34, "18.00")),
    row(398, (33, "SCENA"), (59, "I/E"), (72, "LUCE"), (119, "AMBIENTE"), (328, "SINOSSI"), (507, "ID"), (532, "PAG"), (554, "DAY")),
    row(408, (34, "101")), row(409, (61, "E"), (75, "G"), (86, "GIARDINO"), (185, "Two friends talk"), (499, "1, 4"),
                                (529, "2"), (535, "5/8"), (555, "3")),
    row(430, (34, "102")), row(431, (58, "I/E"), (75, "N"), (86, "CASA ROSSI"), (499, "4"), (529, "1/8"), (555, "3")),
    row(425, (191, "A long synopsis that")), row(436, (191, "goes on below.")),
    row(450, (529, "2 6/8")),
    row(468, (257, "CONVOCAZIONE ATTORI")),
    row(478, (35, "ID"), (80, "RUOLO"), (163, "ATTORE"), (304, "SCENE")),
    row(489, (36, "1"), (52, "Marco Bianchi"), (137, "Actor One"), (245, "101"), (417, "06.45")),
    row(501, (36, "4"), (52, "Lea"), (137, "Actor Two"), (245, "101"), (308, "102"), (417, "07.00")),
    row(512, (34, "12 Pino Lo Russo"), (137, "Actor Three"), (232, "102"), (417, "15.30")),
    row(533, (34, "FABBISOGNI"), (303, "MEZZI DI SCENA")),
    row(545, (34, "101-102: Borsa Lea (telefono,"), (303, "101: Moto Marco")),
    row(557, (34, "chiavi)")),
    row(581, (34, "NOTE REGIA"), (303, "CONTRIBUTI")),
    row(593, (34, "Pioggia finta"), (303, "102: Video on a phone")),
)
SECOND = page(
    row(76, (88, "REGISTA"), (183, "CALL"), (259, "SONORO"), (364, "CALL"), (442, "AGGIUNTI"), (543, "CALL")),
    row(85, (34, "Regista: Some Director"), (182, "07:30"), (212, "Fonico: Mixer Person"), (365, "07:30"),
        (394, "Microfonista: Day Player"), (542, "08:00")),
    row(95, (34, "Autista Regista: Paolo Martello"), (184, "TL"), (212, "Microfonista: Boom Person"), (365, "-")),
    row(104, (34, "Autista MDP: Paolo Masello"), (184, "07:30")),
    row(440, (34, "PROGRAMMA DEL GIORNO SUCCESSIVO, MERCOLEDÌ 4 NOVEMBRE – ORARIO 09.00 – 19.00")),
    row(450, (33, "SCENA"), (59, "I/E"), (72, "LUCE"), (119, "AMBIENTE"), (328, "SINOSSI")),
    row(460, (34, "205A"), (62, "I"), (78, "G"), (108, "UFFICIO"), (191, "Lea calls home"), (496, "4"), (525, "6/8"), (552, "5")),
    row(592, (138, "DIRETTORE DI PRODUZIONE")),
)
ODG = read_lux_vide([FIRST, SECOND])


class LuxVideLayoutTest(unittest.TestCase):
    def test_the_header_gives_day_date_and_times(self):
        self.assertEqual((ODG["number"], ODG["date"], ODG["weekday_printed"]), (12, "2026-11-03", "martedì"))
        self.assertEqual((ODG["call"], ODG["ready_to_shoot"], ODG["end_of_shoot"], ODG["wrap"]),
                         ("07:30", "08:00", "17:30", "18:00"))

    def test_each_word_of_the_scene_table_goes_to_its_column(self):
        first, second = ODG["scenes"]
        self.assertEqual((first["scene_id"], first["int_ext"], first["day_night"], first["set"]), ("101", "EXT", "G", "GIARDINO"))
        self.assertEqual((first["synopsis"], first["cast"], first["pages"], first["story_day"]),
                         ("Two friends talk", ["1", "4"], "2 5/8", "3"))
        self.assertEqual((second["int_ext"], second["set"]), ("INT/EXT", "CASA ROSSI"))

    def test_a_synopsis_on_two_lines_around_its_number_stays_with_its_scene_and_the_total_is_left_out(self):
        second = ODG["scenes"][1]
        self.assertEqual(second["synopsis"], "A long synopsis that goes on below.")
        self.assertEqual(second["pages"], "1/8")

    def test_the_cast_keeps_the_role_as_printed_in_capitals(self):
        self.assertEqual(ODG["cast"], [{"id": "1", "role": "MARCO BIANCHI", "actor": "Actor One"},
                                       {"id": "4", "role": "LEA", "actor": "Actor Two"},
                                       {"id": "12", "role": "PINO LO RUSSO", "actor": "Actor Three"}])

    def test_a_two_digit_id_printed_against_its_role_and_a_scene_number_left_of_its_column_are_read(self):
        third = ODG["cast"][2]
        self.assertEqual((third["id"], third["actor"]), ("12", "Actor Three"), "the scene 102 is not part of the name")

    def test_needs_are_read_column_by_column_and_a_wrapped_line_stays_with_its_item(self):
        notes = ODG["notes"]
        self.assertEqual(notes["101"]["Props"], "Borsa Lea (telefono, chiavi)")
        self.assertEqual(notes["102"]["Props"], "Borsa Lea (telefono, chiavi)")
        self.assertEqual(notes["101"]["Veicoli"], "Moto Marco")
        self.assertEqual(notes["102"]["Contributi"], "Video on a phone")
        self.assertEqual(notes["101"]["Regia"], notes["102"]["Regia"], "no scene numbers: the whole day")

    def test_the_next_day_has_its_date_hours_and_scenes(self):
        advance = ODG["advance"]
        self.assertEqual((advance["day"], advance["date"], advance["call"], advance["wrap"]), (13, "2026-11-04", "09:00", "19:00"))
        self.assertEqual([(s["scene_id"], s["set"], s["cast"]) for s in advance["scenes"]], [("205A", "UFFICIO", ["4"])])

    def test_the_crew_is_read_group_by_group_with_each_call(self):
        crew = read_crew_lines(SECOND[1])
        self.assertEqual(crew[0], {"department": "REGISTA", "role": "Regista", "name": "Some Director", "call": "07:30"})
        sound = [(p["role"], p["name"], p["call"]) for p in crew if p["department"] == "SONORO"]
        self.assertEqual(sound, [("Fonico", "Mixer Person", "07:30"), ("Microfonista", "Boom Person", "-")])
        self.assertIn({"department": "AGGIUNTI", "role": "Microfonista", "name": "Day Player", "call": "08:00"}, crew)
        self.assertEqual(len(crew), 6)

    def test_two_people_with_close_names_and_different_jobs_are_two_people(self):
        crew = [{"name": "Paolo Martello", "job": "Autista Regista"}, {"name": "Maria Federica Rossetti", "job": "Coordinatrice"}]
        self.assertEqual(find_person("Paolo Masello", crew, "Autista MDP"), (None, False))
        self.assertEqual(find_person("M. Federica Rossetti", crew, "Coord OSM")[0]["name"], "Maria Federica Rossetti", "same surname")


if __name__ == "__main__":
    unittest.main()
