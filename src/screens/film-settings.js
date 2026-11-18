// film-settings.js — Film → Settings: the open film's own settings (Ana, 18 Nov): its tag, what kind of project, what the
// calendar marks, how the robots read its papers, sharing with the crew and the backup file. They live in the film's
// settings.json (each film its own). The mic rules are in Film → Lav Rules, the alarms in Today → Alarms.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { tagOf } from '../model.js';
import { downloadProjectFile } from '../state.js';
import { saveSettings, saveTag } from '../kit-editing.js';
import { CALENDAR_MARKS, calendarMarks } from '../overview-rules.js';
import { Icon } from '../parts/icons.js';
import { CopyRules } from '../parts/copy-rules.js';
import { ShareWithCrew } from '../parts/crew-share.js';

function filmFacts(settings) {
  const items = [];
  if (settings.main_unit) items.push(`Any unit other than "${settings.main_unit}" on the ODG is the 2nd unit (shown apart, never on this kit's TX).`);
  if (settings.episodes === 'from_number') items.push('The episode is the number in front of the scene (102 = episode 1).');
  if (settings.scripts?.match) items.push(`Scripts: files named "${settings.scripts.match}…" are read by the robot${settings.kind === 'series' ? '; a new episode script (…EP1…) replaces only that episode' : ''}.`);
  if (settings.sides_by === 'date') items.push('Sides (stralci) are matched to their day by date and scenes, never by the number in their name.');
  if (settings.calendar) items.push(`Phone calendar: ${settings.calendar === 'days_with_2nd_unit' ? 'only the days with a 2nd unit' : 'every shooting day'}.`);
  if (settings.kit) items.push(`Gear: the "${settings.kit}" kit.`);
  if (settings.group_cues?.length) items.push(`Group cues, not a character: ${settings.group_cues.join(', ')}.`);
  if (settings.workday) items.push(`Working day: ${settings.workday} from call to wrap.`);
  if (settings.overtime?.double_after) items.push(`Overtime counts double after the first ${settings.overtime.double_after} min.`);
  if (settings.voices?.language) items.push(`Voices for hearing the lines: ${settings.voices.language}${settings.voices.male ? ` (men: ${settings.voices.male})` : ''}.`);
  return items;
}

export function FilmSettingsScreen({ state }) {
  const { project, connection } = state;
  const settings = project.settings || {};
  const facts = filmFacts(settings);
  return html`
    <div class="help-page">
      <h2 class="section-title">${project.name} <${FilmTag} project=${project} /></h2>
      ${project.aliases?.length > 0 && html`<p>Also called: <b>${project.aliases.join(', ')}</b></p>`}
      <${ProjectKind} settings=${settings} />
      <h2 class="section-title">The calendar marks</h2>
      <div class="segmented">
        ${CALENDAR_MARKS.map(([id, label]) => html`
          <button key=${id} class=${calendarMarks(settings) === id ? 'on' : ''}
                  onClick=${() => saveSettings({ calendar_marks: id }, `The calendar marks: ${label}.`)}>${label}</button>`)}
      </div>
      ${facts.length > 0 && html`
        <h2 class="section-title">This film</h2>
        <ul class="help">${facts.map(text => html`<li key=${text}>${text}</li>`)}</ul>`}
      ${connection && html`<${ShareWithCrew} state=${state} />`}
      <h2 class="section-title">Backup</h2>
      <button class="btn" onClick=${downloadProjectFile}><${Icon} name="download" /> Save backup file of ${project.name}</button>
      <${CopyRules} project=${project} />
    </div>`;
}

// the film's tag ('LBE'): tap to change it — every exported file starts with it
function FilmTag({ project }) {
  const [typing, setTyping] = useState(null);
  if (typing !== null) {
    return html`<form class="film-tag-form" onSubmit=${e => { e.preventDefault(); saveTag(typing); setTyping(null); }}>
      <input value=${typing} onInput=${e => setTyping(e.target.value)} maxlength="6" aria-label="Film tag" autofocus />
      <button class="btn btn--small btn--primary">Save</button></form>`;
  }
  return html`<button class="film-tag" onClick=${() => setTyping(tagOf(project))} title="The film's tag: exported files start with it">${tagOf(project)}</button>`;
}

// What kind of project (Ana, 3 Nov): a film or a TV series (scenes by episode, one script per episode: a new
// Ep 1 script replaces only Ep 1), and 1 or 2 units (with 2: the main unit's name as the ODG prints it).
function ProjectKind({ settings }) {
  const series = settings.kind === 'series' || settings.episodes === 'from_number';
  const units = settings.units === 2 || settings.main_unit ? 2 : 1;
  const [unitName, setUnitName] = useState(settings.main_unit || '');
  const choose = (label, on, onClick) => html`<button class=${on ? 'on' : ''} onClick=${onClick}>${label}</button>`;
  return html`
    <h2 class="section-title">What kind of project</h2>
    <div class="segmented">
      ${choose('Film', !series, () => saveSettings({ kind: 'film', episodes: null }, 'A film: one script, scenes in one list.'))}
      ${choose('TV series', series, () => saveSettings({ kind: 'series', episodes: 'from_number' }, 'A TV series: scenes by episode (102 = episode 1), one script per episode.'))}
    </div>
    <div class="segmented">
      ${choose('1 unit', units === 1, () => saveSettings({ units: 1, main_unit: null }, 'One unit.'))}
      ${choose('2 units', units === 2, () => saveSettings({ units: 2 }, 'Two units: the 2nd unit is shown apart and never takes this kit.'))}
    </div>
    ${units === 2 && html`
      <form class="field" onSubmit=${e => { e.preventDefault(); saveSettings({ main_unit: unitName.trim().toUpperCase() }, `Main unit: "${unitName.trim().toUpperCase()}".`); }}>
        Main unit's name on the ODG ("UNIT ALFIERI" → ALFIERI)
        <span class="toolbar"><input value=${unitName} onInput=${e => setUnitName(e.target.value)} placeholder="e.g. ALFIERI" />
          <button class="btn btn--small">Save</button></span>
      </form>`}`;
}
