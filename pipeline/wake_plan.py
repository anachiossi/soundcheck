"""wake_plan.py — the night before a shooting day, from its call (same rules as the app's
src/hours-rules.js wakePlan; Ana's "hora de acordar" calculator, 1 Oct 2026):
    meeting point = call − meet_before_call · leave = meeting − travel_max … meeting − travel_min
    wake = leave − get_ready · sleep = wake − sleep_hours
Riding with someone ("ride_with": "<name as printed on the ODG>", Ana 11 Oct): the sums start from THAT person's
call on the ODG (calls.json); not known yet → Ana's call − ride_gap_if_unknown (40: the widest gap seen).
Ana's own call ("my_name", Ana 16 Oct): when she picks "Personal call" in the app's My call, the app saves
her name as printed on the call sheet in commute → "my_name". Found in that day's calls.json → that is her
call; not there (or no my_name) → the day's general crew call. Same as the app (my-call.js).
Names match with no capitals, accents or extra spaces ('Inês  Rossi' = 'ines rossi'), for both names.
The film's numbers: settings.json → "commute" (no "commute": no plan, no notification).
Used by: run.py (the "Tomorrow" notification when the ODG arrives)
"""

import json
import unicodedata
from pathlib import Path

COMMUTE = {"meet_before_call": 45, "travel_min": 75, "travel_max": 90, "get_ready": 45, "sleep_hours": 8,
           "ride_with": "", "ride_gap_if_unknown": 40, "my_name": ""}


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


def plain_name(text):
    """'Inês  Rossi ' → 'ines rossi' (the app's plainName in my-call.js)"""
    letters = unicodedata.normalize("NFD", str(text or ""))
    without_accents = "".join(c for c in letters if not unicodedata.combining(c))
    return " ".join(without_accents.lower().split())


def call_of(name, calls):
    """The call printed next to this name that day (calls = { name: 'HH:MM' }), in minutes; None when not there."""
    wanted = plain_name(name)
    if not wanted:
        return None
    return next((minutes_of(c) for n, c in calls.items() if plain_name(n) == wanted), None)


def own_call(commute, call, calls):
    """Ana's own call: her name's call that day (commute my_name), else the day's general call."""
    mine = call_of(commute.get("my_name", ""), calls)
    return mine if mine is not None else minutes_of(call)


def ride_call(commute, own, calls):
    """The minutes the plan starts from: own call, or the ride's call (calls = { name: 'HH:MM' } that day)."""
    if not plain_name(commute.get("ride_with", "")):
        return own, ""
    theirs = call_of(commute["ride_with"], calls)
    return (theirs, clock(theirs)) if theirs is not None else (own - commute["ride_gap_if_unknown"], "?")


def wake_plan(commute, call, calls=None):
    """'09:00' (the day's general call) → {'call': '09:00', 'ride_call': '', 'meet': '08:15', 'leave_from': '06:45',
    'leave_to': '07:00', 'wake': '06:00', 'sleep': '22:00'} ('call' = Ana's own call: see my_name above)"""
    own = own_call(commute, call, calls or {})
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
