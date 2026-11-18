"""second_unit_days.py — a 2nd unit printed on a new ODG goes straight into the schedule, so the alarms of a film that works
only the days with a 2nd unit ring even before Ana reviews the ODG (Il colpo's day 67, 18 Nov: "SPLINTER" tomorrow, no alarm).
Only adds the rows of a date with no 2nd unit yet: never removes or changes anything. The proposal still lists the change.
Used by: run.py · tests: tests/test_second_unit_days.py
"""

import json
from pathlib import Path


def row_line(row):
    return "  { " + json.dumps(row, ensure_ascii=False)[1:-1] + " }"


def add_second_unit_days(folder, proposal):
    """→ True when schedule.json got new rows."""
    folder = Path(folder)
    settings = json.loads((folder / "settings.json").read_text(encoding="utf-8"))
    if (settings.get("commute") or {}).get("days") != "days_with_2nd_unit":
        return False
    path = folder / "schedule.json"
    text = path.read_text(encoding="utf-8")
    schedule = json.loads(text)
    new_rows = []
    for change in proposal["changes"]:
        op = change["op"]
        date = (op.get("fields") or {}).get("date")
        taken = any(row.get("date") == date and row.get("unit") for row in schedule + new_rows)
        if op["op"] != "set_day_scenes" or op.get("unit") != "2nd" or not op["scene_ids"] or not date or taken:
            continue
        fields = op["fields"]
        new_rows += [{"day": op["day"], "date": date, "week": fields.get("week", 0), "call": fields.get("call", ""), "wrap": fields.get("wrap", ""),
                      "scene_id": scene_id, "order": order, "unit": "2nd", "unit_name": fields.get("unit_name", "")}
                     for order, scene_id in enumerate(op["scene_ids"], 1)]
    if not new_rows:
        return False
    body = text.rstrip()[:-1].rstrip()
    path.write_text(body + ",\n" + ",\n".join(row_line(row) for row in new_rows) + "\n]\n", encoding="utf-8")
    return True
