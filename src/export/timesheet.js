// timesheet.js — the week's time sheet as an editable Excel file, for production (Ana, 2 Oct): one block
// per person of the sound department (Fonico, Microfonista, Aiuto…, from the IFB crew list), each with
// the week's shooting days — date, call, ODG wrap, real wrap — and Excel formulas for the hours worked
// and the overtime (from the film's working day, e.g. 8h continuate), and the week's total. Everyone
// starts with the times logged in the app (the department works the same hours); any cell can be changed
// in Excel and the formulas follow. No lunch, travel or euro (Ana). Headers in Italian (for production).
// The days come from the Hours screen, so their call is "My call" (my-call.js).
// A crew phone ("Export my timesheet"): only that person's own block (onlyName = the name in their link).
// Used by: screens/hours.js

import { WORKDAYS, workdayOf } from '../hours-rules.js';
import { xlsxBlob } from './xlsx.js';
import { sameName } from '../my-call.js';

const SOUND_JOBS = /fonic|microfon|boom|sound|suono|audio/i;

// the sound department, from the IFB crew list (in the list's order)
export const soundPeople = project => (project.crew || []).filter(person => SOUND_JOBS.test(person.job || ''));

// the blocks of the sheet: the sound department, or only one person (with their job when the
// IFB crew list has them)
export function timesheetPeople(project, onlyName = '') {
  if (!onlyName) return soundPeople(project);
  const listed = (project.crew || []).find(person => sameName(person.name, onlyName));
  return [listed || { name: onlyName, job: '' }];
}

// '2026-09-28' → 'lun 28/09/2026'
const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const italianDate = iso => `${WEEKDAYS[new Date(`${iso}T12:00`).getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const HEADER = ['Giorno', 'Data', 'Convocazione', 'Fine ODG', 'Fine reale', 'Ore lavorate', 'Straordinario'];

export function timesheetBlob(project, days, weekTitle, onlyName = '') {
  const people = timesheetPeople(project, onlyName);
  const kind = WORKDAYS[workdayOf(project)];
  const hours = kind?.hours || 8;
  const rows = [
    [{ text: `${project.name} · Foglio ore · Reparto suono`, bold: true }],
    [`Settimana ${weekTitle}`, '', '', `Giornata: ${kind ? kind.label : `${hours}h`}`],
    [],
  ];
  const bold = [0];
  for (const person of people) {
    rows.push([{ text: person.name, bold: true }, person.job || '']);
    bold.push(rows.length - 1);
    rows.push(HEADER);
    bold.push(rows.length - 1);
    const first = rows.length + 1; // Excel rows start at 1
    for (const d of days) {
      const r = rows.length + 1;
      rows.push([`D${String(d.day).padStart(2, '0')}`, italianDate(d.date),
        { time: d.call }, { time: d.wrap }, d.real_wrap ? { time: d.real_wrap } : '',
        { f: `IF(E${r}="","",MOD(E${r}-C${r},1))` }, { f: overtimeFormula(project, `F${r}`, hours) }]);
    }
    const last = rows.length;
    rows.push(['', '', '', '', '', { text: 'Totale', bold: true }, { f: `SUM(G${first}:G${last})`, bold: true }]);
    rows.push([]);
  }
  if (!people.length) rows.push(['No sound department in the crew list (IFB → Crew).']);
  return xlsxBlob([{ name: 'Foglio ore', rows, bold, freeze: 0 }]);
}

// the overtime cell: beyond the working day; with settings.overtime.double_after, the minutes after that
// much overtime count double (hours-rules.js → countedOvertime)
function overtimeFormula(project, cell, hours) {
  const after = project.settings?.overtime?.double_after;
  const over = `MAX(0,${cell}-TIME(${hours},0,0))`;
  if (typeof after !== 'number') return `IF(${cell}="","",${over})`;
  const at = `TIME(0,${after},0)`;
  return `IF(${cell}="","",MIN(${over},${at})+2*MAX(0,${over}-${at}))`;
}
