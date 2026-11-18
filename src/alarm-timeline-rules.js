// alarm-timeline-rules.js — turns the alarm robot's plan (pipeline/gmail-trigger.gs planAnswer) into the lines of the
// morning timeline, top to bottom (Ana, 18 Nov: "I liked the idea of a timeline for the alarm"):
//   22:30 Bed · 06:00 Alarm: wake up · 06:45 Alarm: 15 min to go · 07:00 Leave home · 07:20 Car with … · 08:00 Call
// Only the alarms ring (rings: true). No alarm sums here: every time is the robot's; this file only counts the
// minutes BETWEEN two of them, for the small words under a line ("15 min to go", "7½ h sleep").
// Also: which shooting days get no alarm before the next one, said in plain words (a film whose alarms follow
// only the days with a 2nd unit, settings commute.days).
// Used by: parts/alarm-timeline.js

import { shootingDays } from './model.js';

const HOW = { walk: 'walk', transit: 'public transport', fixed: 'to the meeting point' };

// '06:45', '07:00' → 15 (also across midnight: '23:30', '00:15' → 45)
export function minutesBetween(from, to) {
  const [fromHours, fromMinutes] = from.split(':').map(Number);
  const [toHours, toMinutes] = to.split(':').map(Number);
  return (toHours * 60 + toMinutes - (fromHours * 60 + fromMinutes) + 1440) % 1440;
}

// the sleep between bedtime and the wake-up, to the half hour: '7½ h sleep'
export function sleepText(plan) {
  const halves = Math.round(minutesBetween(plan.sleep, plan.wake) / 30);
  return `${Math.floor(halves / 2)}${halves % 2 ? '½' : ''} h sleep`;
}

// [{ time, title, note, rings }] in the order of the morning
export function timelineRows(plan, { rideGap = 40 } = {}) {
  const first = (plan.rideWith || '').split(' ')[0];
  const toMeeting = plan.toMeeting?.minutes ? `${HOW[plan.toMeeting.mode] || plan.toMeeting.mode} ${plan.toMeeting.minutes} min` : '';
  const drive = plan.drive?.minutes ? `drive ${plan.drive.minutes} min` : '';
  const ride = !first ? ''
    : plan.rideCall ? `${first}'s call ${plan.rideCall}`
    : `${first}'s call isn't out yet: counted ${rideGap} min before yours`;
  const alarmAtLeaving = plan.leaveAlarm === plan.walkOut;
  const meetingLine = plan.rideLeaves && plan.rideLeaves !== plan.walkOut;

  const rows = [
    { time: plan.sleep, title: 'Bed', note: sleepText(plan) },
    { time: plan.wake, title: 'Alarm: wake up', rings: true },
  ];
  if (!alarmAtLeaving) {
    rows.push({ time: plan.leaveAlarm, title: `Alarm: ${minutesBetween(plan.leaveAlarm, plan.walkOut)} min to go`, rings: true });
  }
  rows.push({ time: plan.walkOut, title: alarmAtLeaving ? 'Alarm: leave home' : 'Leave home', rings: alarmAtLeaving,
    note: (meetingLine ? [toMeeting] : [toMeeting, drive, ride]).filter(Boolean).join(' · ') });
  if (meetingLine) {
    rows.push({ time: plan.rideLeaves, title: first ? `Car with ${first}` : 'Meeting point', note: [drive, ride].filter(Boolean).join(' · ') });
  }
  if (plan.onSet && plan.onSet !== plan.call && plan.onSet !== plan.rideLeaves) {
    rows.push({ time: plan.onSet, title: 'On set', note: `${minutesBetween(plan.onSet, plan.call)} min before the call` });
  }
  rows.push({ time: plan.call, title: 'Call' });
  return rows;
}

// 'D66–69: no alarm (no 2nd unit those days)' for the shooting days from today up to the next alarm's day that get no
// alarm; '' when none, or when the film's alarms follow every shooting day
export function skippedDaysText(project, plan, today) {
  if (project.settings?.commute?.days !== 'days_with_2nd_unit') return '';
  const numbers = shootingDays(project)
    .filter(day => day.date >= today && day.date < plan.date && !day.second)
    .map(day => day.day)
    .sort((a, b) => a - b);
  if (!numbers.length) return '';
  const runs = [];
  for (const number of numbers) {
    const last = runs[runs.length - 1];
    if (last && number === last[1] + 1) last[1] = number;
    else runs.push([number, number]);
  }
  const days = runs.map(([from, to]) => (from === to ? `D${from}` : `D${from}–${to}`)).join(', ');
  return `${days}: no alarm (no 2nd unit ${numbers.length === 1 ? 'that day' : 'those days'})`;
}

// does the next alarm's day have a 2nd unit? (the violet mark on the card)
export const hasSecondUnit = (project, plan) => Boolean(shootingDays(project).find(day => day.day === plan.day)?.second);
