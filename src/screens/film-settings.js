// film-settings.js — Film → Settings: the open film's own settings (Ana, 18 Nov): its tag, what kind of project, what the
// calendar marks, how the robots read its papers (parts/film-fields.js), sharing with the crew and the backup file. They live in the film's
// settings.json (each film its own). The mic rules are in Mics → Presets, the alarms in Today → Alarms.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { tagOf } from '../model.js';
import { downloadProjectFile } from '../state.js';
import { saveSettings, saveTag } from '../kit-editing.js';
import { CALENDAR_MARKS, calendarMarks } from '../overview-rules.js';
import { Icon } from '../parts/icons.js';
import { CopyRules } from '../parts/copy-rules.js';
import { FilmFields } from '../parts/film-fields.js';
import { ShareWithCrew } from '../parts/crew-share.js';

export function FilmSettingsScreen({ state }) {
  const { project, connection } = state;
  const settings = project.settings || {};
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
      <${FilmFields} settings=${settings} />
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
    ${series && html`<p class="muted">The episode is the number in front of the scene (102 = episode 1). A new script replaces only its own episode.</p>`}
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
