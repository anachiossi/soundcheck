"""wake_plan.py — the night before a shooting day, from its call (same rules as the app's
src/hours-rules.js wakePlan; Ana's "hora de acordar" calculator, 1 Oct 2026):
    meeting point = call − meet_before_call · leave = meeting − travel_max … meeting − travel_min
    wake = leave − get_ready · sleep = wake − sleep_hours
Riding with someone ("ride_with": "<name as printed on the ODG>", Ana 11 Oct): the sums start from THAT person's
call on the ODG (calls.json); not known yet → Ana's call − ride_gap_if_unknown (40: the widest gap seen).
The film's numbers: settings.json → "commute" (no "commute": no plan, no notification).
Used by: run.py (the "Tomorrow" notification when the ODG arrives)
"""

import json
from pathlib import Path

COMMUTE = {"meet_before_call": 45, "travel_min": 75, "travel_max": 90, "get_ready": 45, "sleep_hours": 8,
           "ride_with": "", "ride_gap_if_unknown": 40}


def commute_of(film):
    settings = Path(film) / "settings.json"
    data = json.loads(settings.read_text(encoding="utf-8")) if settings.exists() else {}
    return {**COMMUTE, **data["commute"]} if "commute" in data else None


def clock(minutes):
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def minutes_of(call):
    try:
        hours, minutes = (int(x) for x in str(call).replace(".", ":").split(":")[:2])
    except ValueError:
        return None
    return hours * 60 + minutes


def ride_call(commute, own, calls):
    """The minutes the plan starts from: own call, or the ride's call (calls = { name: 'HH:MM' } that day)."""
    name = " ".join(commute.get("ride_with", "").lower().split())
    if not name:
        return own, ""
    theirs = next((minutes_of(c) for n, c in calls.items() if " ".join(n.lower().split()) == name), None)
    return (theirs, clock(theirs)) if theirs is not None else (own - commute["ride_gap_if_unknown"], "?")


def wake_plan(commute, call, calls=None):
    """'09:00' → {'call': '09:00', 'ride_call': '', 'meet': '08:15', 'leave_from': '06:45', 'leave_to': '07:00',
    'wake': '06:00', 'sleep': '22:00'}"""
    own = minutes_of(call)
    if own is None:
        return None
    start, shown = ride_call(commute, own, calls or {})
    meet = start - commute["meet_before_call"]
    leave_from = meet - commute["travel_max"]
    wake = leave_from - commute["get_ready"]
    return {"call": clock(own), "ride_call": shown, "meet": clock(meet), "leave_from": clock(leave_from),
            "leave_to": clock(meet - commute["travel_min"]), "wake": clock(wake),
            "sleep": clock(int(wake - commute["sleep_hours"] * 60))}


if __name__ == "__main__":
    print(wake_plan(COMMUTE, "09:00"))
    ride = {**COMMUTE, "meet_before_call": 75, "travel_min": 30, "travel_max": 45, "ride_with": "Maria Rossi"}
    print(wake_plan(ride, "09:00", {"Maria Rossi": "08:50"}))
    print(wake_plan(ride, "09:00", {}))
