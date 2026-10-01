"""wake_plan.py — the night before a shooting day, from its call (same rules as the app's
src/hours-rules.js wakePlan; Ana's "hora de acordar" calculator, 1 Oct 2026):
    meeting point = call − meet_before_call · leave = meeting − travel_max … meeting − travel_min
    wake = leave − get_ready · sleep = wake − sleep_hours
The film's numbers: settings.json → "commute" (no "commute": no plan, no notification).
Used by: run.py (the "Tomorrow" notification when the ODG arrives)
"""

import json
from pathlib import Path

COMMUTE = {"meet_before_call": 45, "travel_min": 75, "travel_max": 90, "get_ready": 45, "sleep_hours": 8}


def commute_of(film):
    settings = Path(film) / "settings.json"
    data = json.loads(settings.read_text(encoding="utf-8")) if settings.exists() else {}
    return {**COMMUTE, **data["commute"]} if "commute" in data else None


def clock(minutes):
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def wake_plan(commute, call):
    """'09:00' → {'meet': '08:15', 'leave_from': '06:45', 'leave_to': '07:00', 'wake': '06:00', 'sleep': '22:00'}"""
    try:
        hours, minutes = (int(x) for x in str(call).replace(".", ":").split(":")[:2])
    except ValueError:
        return None
    meet = hours * 60 + minutes - commute["meet_before_call"]
    leave_from = meet - commute["travel_max"]
    wake = leave_from - commute["get_ready"]
    return {"call": f"{hours:02d}:{minutes:02d}", "meet": clock(meet), "leave_from": clock(leave_from),
            "leave_to": clock(meet - commute["travel_min"]), "wake": clock(wake),
            "sleep": clock(int(wake - commute["sleep_hours"] * 60))}


if __name__ == "__main__":
    print(wake_plan(COMMUTE, "09:00"))
