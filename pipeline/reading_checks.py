"""reading_checks.py — is this reading of a call sheet (ODG) believable? Two nets, both free and automatic:

  1. odg_problems(odg): sums and counts that a right reading always passes — an ODG number, a date, the hours,
     at least one scene, no scene twice, the pages adding up to the total the sheet prints, every cast number
     of a scene present in the sheet's own cast list.
  2. readings_differ(own, other): the same PDF read a second time by the table reader (read_odg_table.py, which
     works from the table's header words, another way than the film's own reader). Two readers that go wrong
     the same way are rare: where they disagree, somebody has to look at the PDF.

reading_warnings() runs both and gives the lines that go on top of the proposal, so a misread sheet says so
before Ana accepts it (ODG #14, #59 and #61 were accepted misreadings). It never changes the reading itself.
Used by: propose.py · tests: tests/test_reading_checks.py
"""

import re


def eighths(pages):
    """'1 3/8' → 11 · '6/8' → 6 · '2' → 16 · '' or unreadable → None (pages are counted in eighths)."""
    match = re.fullmatch(r"\s*(?:(\d+)\s+)?(\d)/8\s*|\s*(\d+)\s*", pages or "")
    if not match:
        return None
    whole, part, alone = match.groups()
    return int(alone) * 8 if alone else int(whole or 0) * 8 + int(part)


def odg_problems(odg):
    """What looks wrong in one reading: a list of plain sentences (empty = nothing found)."""
    problems = []
    scenes = odg.get("scenes") or []
    for key, name in (("number", "ODG number"), ("date", "date"), ("call", "call time"), ("wrap", "wrap time")):
        if not odg.get(key):
            problems.append(f"no {name} was read")
    if not scenes:
        problems.append("no scene was read for the day")
    ids = [scene["scene_id"] for scene in scenes]
    twice = sorted({scene_id for scene_id in ids if ids.count(scene_id) > 1})
    if twice:
        problems.append(f"scene {', '.join(twice)} was read more than once")
    printed = eighths(odg.get("pages_total_printed"))
    counted = [eighths(scene.get("pages")) for scene in scenes]
    # (a two-unit day prints one total per unit: not compared)
    if printed is not None and None not in counted and sum(counted) != printed and not odg.get("second_unit"):
        problems.append(f"the scenes' pages add up to {sum(counted)}/8, the sheet prints a total of {printed}/8: "
                        "a scene may be missing or misread")
    known = {member["id"] for member in odg.get("cast") or []}
    if known:
        unknown = sorted({number for scene in scenes for number in scene.get("cast") or [] if number not in known}, key=int)
        if unknown:
            problems.append(f"cast number {', '.join(unknown)} is in a scene but not in the sheet's cast list")
    if odg.get("second_unit") and not any(scene.get("unit") == "2nd" for scene in scenes):
        problems.append("a 2nd unit is printed but none of the scenes was read as its own")
    if odg.get("second_unit") and all(scene.get("unit") == "2nd" for scene in scenes) and scenes:
        problems.append("every scene was read as the 2nd unit's: the main unit has none")
    return problems


def readings_differ(own, other):
    """Where two readings of the same sheet disagree, as plain sentences. `own` is the film's reader."""
    differences = []
    for key, name in (("number", "ODG number"), ("date", "date"), ("call", "call"), ("wrap", "wrap")):
        if other.get(key) and own.get(key) != other.get(key):
            differences.append(f"{name}: read as {own.get(key) or 'nothing'}, the second reader reads {other[key]}")
    for label, mine, theirs in (("today", own.get("scenes") or [], other.get("scenes") or []),
                                ("the next day", (own.get("advance") or {}).get("scenes") or [],
                                 (other.get("advance") or {}).get("scenes") or [])):
        my_ids, their_ids = [s["scene_id"] for s in mine], [s["scene_id"] for s in theirs]
        only_theirs = [i for i in their_ids if i not in my_ids]
        only_mine = [i for i in my_ids if i not in their_ids]
        if only_theirs:
            differences.append(f"{label}: the second reader also sees scene {', '.join(only_theirs)}")
        if only_mine:
            differences.append(f"{label}: the second reader does not see scene {', '.join(only_mine)}")
        if not only_theirs and not only_mine and my_ids != their_ids:
            differences.append(f"{label}: the scenes are in another order for the second reader ({' · '.join(their_ids)})")
        by_id = {s["scene_id"]: s for s in theirs}
        for scene in mine:
            twin = by_id.get(scene["scene_id"])
            if not twin:
                continue
            if sorted(scene.get("cast") or []) != sorted(twin.get("cast") or []):
                differences.append(f"scene {scene['scene_id']}: cast {', '.join(scene.get('cast') or []) or 'nobody'}, "
                                   f"the second reader reads {', '.join(twin.get('cast') or []) or 'nobody'}")
            if (scene.get("unit") == "2nd") != (twin.get("unit") == "2nd"):
                differences.append(f"scene {scene['scene_id']}: the two readers put it in different units")
    return differences


def reading_warnings(odg, pdf, settings, second_reader=None):
    """The lines for the top of the proposal. second_reader(pdf) → a reading; None = the table reader."""
    lines = [f"⚠ Reading check: {problem}." for problem in odg_problems(odg)]
    if odg.get("reader") == "table":  # the film already uses the table reader: no second opinion to ask
        return lines
    try:
        if second_reader is None:
            from odg_template import template_for
            from read_odg_table import read_odg_table
            other = read_odg_table(pdf, template_for(settings), (settings or {}).get("main_unit"))
        else:
            other = second_reader(pdf)
    except Exception:  # the second opinion must never stop the robot
        return lines
    if not other.get("scenes"):  # this sheet has no table the second reader knows: nothing to compare
        return lines
    lines += [f"⚠ Two readers disagree — look at the PDF. {difference}." for difference in readings_differ(odg, other)]
    lines += [f"⚠ Reading check: {problem}." for problem in odg_problems({**odg, "pages_total_printed": other.get("pages_total_printed"), "cast": odg.get("cast") or other.get("cast")})
              if f"⚠ Reading check: {problem}." not in lines]
    return lines
