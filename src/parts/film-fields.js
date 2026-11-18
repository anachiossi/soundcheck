// film-fields.js — how the robots read this film's papers, as fields to change (Film → Settings, Ana 18 Nov: "if they
// could be fields to be changed just as if they were a template configuration then they should exist on the app").
// Each one is saved in the film's settings.json.
// Used by: screens/film-settings.js

import { html, useState } from '../../vendor/preact-htm.js';
import { saveSettings } from '../kit-editing.js';

const SIDES = [['', 'The number in the file name'], ['date', 'Their date and scenes']];
const CALENDAR = [['', 'Off'], ['all', 'Every shooting day'], ['days_with_2nd_unit', 'Only the days with a 2nd unit']];

function Choice({ label, value, options, onChange }) {
  return html`
    <label class="field">${label}
      <select value=${value || ''} onChange=${event => onChange(event.target.value || null)}>
        ${options.map(([id, name]) => html`<option key=${id} value=${id}>${name}</option>`)}
      </select>
    </label>`;
}

function TextField({ label, value, placeholder, type = 'text', onSave }) {
  const [text, setText] = useState(value);
  return html`
    <form class="field" onSubmit=${event => { event.preventDefault(); onSave(text.trim()); }}>${label}
      <span class="toolbar"><input type=${type} value=${text} placeholder=${placeholder} onInput=${event => setText(event.target.value)} />
        <button class="btn btn--small">Save</button></span>
    </form>`;
}

export function FilmFields({ settings }) {
  const cues = (settings.group_cues || []).join(', ');
  const saveCues = text => saveSettings({ group_cues: text.split(',').map(cue => cue.trim().toUpperCase()).filter(Boolean) }, 'Group cues saved.');
  const saveScripts = match => saveSettings({ scripts: match ? { ...settings.scripts, match } : null }, 'Script files saved.');
  const saveOvertime = minutes => saveSettings({ overtime: Number(minutes) > 0 ? { ...settings.overtime, double_after: Number(minutes) } : null }, 'Overtime saved.');
  return html`
    <h2 class="section-title">Reading the papers</h2>
    <${TextField} key=${`scripts-${settings.scripts?.match}`} label="Script files have this in their name" value=${settings.scripts?.match || ''}
      placeholder="e.g. LA LISTA" onSave=${saveScripts} />
    <${Choice} label="Sides find their day by" value=${settings.sides_by} options=${SIDES}
      onChange=${value => saveSettings({ sides_by: value }, 'Sides saved.')} />
    <${TextField} key=${`cues-${cues}`} label="Group cues, not a character (commas between them)" value=${cues}
      placeholder="e.g. TUTTI, INSIEME" onSave=${saveCues} />

    <h2 class="section-title">Calendar and overtime</h2>
    <${Choice} label="Phone calendar" value=${settings.calendar} options=${CALENDAR}
      onChange=${value => saveSettings({ calendar: value }, 'Phone calendar saved.')} />
    <${TextField} key=${`overtime-${settings.overtime?.double_after}`} type="number" label="Overtime counts double after (minutes)"
      value=${String(settings.overtime?.double_after || '')} placeholder="Never" onSave=${saveOvertime} />`;
}
