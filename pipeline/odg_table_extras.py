"""odg_table_extras.py — what the template reader (read_odg_table.py) reads OUTSIDE the tables of a call sheet:
  • "ODG #48 di 87" → of_days 87 · "Settimana #10" → week 10 · the rehearsal time after "PROVE"
  • the departments' needs (FABBISOGNI) per scene, today's and the next day's (odg_needs.py)
The words come from the template (odg_template.py: "week", "labels", "needs", "departments").
Used by: read_odg_table.py · tests: tests/test_read_odg_table.py
"""

import re

from odg_needs import read_needs, unit_spelling


def day_count_and_week(text, template):
    """→ (of_days or None, week or None)"""
    of_days = re.search(r"ODG\s*#?\s*\d+\s*di\s*(\d+)", text, re.I)
    week = re.search(r"(?:" + "|".join(re.escape(word) for word in template["week"]) + r")\s*#?\s*(\d+)", text, re.I)
    return (int(of_days.group(1)) if of_days else None), (int(week.group(1)) if week else None)


def unit_groups(scenes, second, main_unit):
    """{ 'ALFIERI': [its scenes], 'DE FEUDIS': [its scenes] } on a two-unit day (a need can be for one unit only)."""
    if not second:
        return {}
    return {(main_unit or "").upper(): [s["scene_id"] for s in scenes if not s.get("unit")],
            second["name"].upper(): [s["scene_id"] for s in scenes if s.get("unit")]}


def needs_of_pages(pages, template, today, tomorrow, main_unit):
    """today / tomorrow = (scenes, second unit or None). → (today's notes, the next day's notes), each
    { scene: { department: text } }. Pages with no "text_lines" (a test's plain tables): no notes."""
    lines = [unit_spelling(line) for page in pages for line in page.get("text_lines", [])]
    if not lines:
        return {}, {}
    departments = {word.upper(): name for name, words in template["departments"].items() for word in words}
    next_at = next((i for i, line in enumerate(lines)
                    if any(line.upper().startswith(word) for word in template["next_day"])), len(lines))
    found = []
    for part, marker, (scenes, second) in ((lines[:next_at], template["needs"]["today"][0], today),
                                           (lines[next_at:], template["needs"]["next_day"][0], tomorrow)):
        ids = [scene["scene_id"] for scene in scenes]
        found.append(read_needs(part, marker, ids, unit_groups(scenes, second, main_unit), departments) if ids else {})
    return found[0], found[1]
