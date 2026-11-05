// film-rules.js — the Film rules page (Projects → 📋 Film rules): every rule this film's robots and preset
// generator follow, in plain words, so Ana can recall them (3 Nov, Il colpo: "make a settings page for these
// rules so I can recall eventually"). At the top, what kind of project (film / TV series, 1 or 2 units), to change
// here. The rules live in the film's settings.json (each film its own); at the
// bottom, "Copy rules from another film" (film-rules-copy.js) brings another film's rules in.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';
import { RULE_GROUPS, otherFilms, copyRules } from '../film-rules-copy.js';
import { saveSettings } from '../kit-editing.js';

const LAV_NAMES = { cos11: 'Sanken COS-11', 6060: 'DPA 6060', 6061: 'DPA 6061', 4060: 'DPA 4060', 4061: 'DPA 4061' };
const lavName = model => LAV_NAMES[model] || model;
const GENDER = { F: 'women', M: 'men' };
const COLOUR_NAMES = { '#000000': 'black', '#ffffff': 'white', '#faf1d9': 'beige' };

function micRules(project) {
  const rules = project.settings?.presets || {};
  const name = id => project.characters.find(c => c.id === String(id))?.name || `#${id}`;
  const items = [];
  if (rules.wire_silent === 'recurring') items.push('Every main and medium character gets a TX and a lav, even when silent. One-liners (brown) only when they speak; voices off set (grey) never.');
  else items.push('A TX and a lav only for who speaks in the scene.');
  if (rules.protagonist) items.push(`The protagonist, ${name(rules.protagonist)}, is always wired and keeps the same TX.`);
  if (rules.same_tx_all_day) items.push('A character keeps the same TX and lav all day.');
  if (rules.tx_order?.length) items.push(`TX order: ${rules.tx_order.join(', ')}.`);
  if (rules.not_for_actors?.length) items.push(`Never on an actor: ${rules.not_for_actors.join(', ')} (the booms).`);
  const lav = rules.lav_rules || {};
  for (const [gender, model] of Object.entries(lav.by_gender || {})) items.push(`Lav for ${GENDER[gender] || gender}: ${lavName(model)}.`);
  if (lav.loud) items.push(`Screamers: ${lavName(lav.loud)}.`);
  if (lav.not_used?.length) items.push(`Never used: ${lav.not_used.map(lavName).join(', ')}.`);
  for (const [tx, model] of Object.entries(lav.lav_for_tx_model || {})) items.push(`With a ${tx} TX: always ${lavName(model)}.`);
  const gearName = id => (project.gearItems || []).find(g => g.id === id)?.name || id;
  for (const rule of rules.lav_accessories || []) {
    items.push(`${rule.scenes.join(' / ')} scenes, lav colour ${COLOUR_NAMES[rule.lav_colour.toLowerCase()] || rule.lav_colour}: ${gearName(rule.gear)}.`);
  }
  if (rules.small_day_max_speakers) items.push(`A "small day" has at most ${rules.small_day_max_speakers} speakers per scene.`);
  return items;
}

function filmRules(settings) {
  const items = [];
  if (settings.main_unit) items.push(`Main unit: "${settings.main_unit}" on the ODG; any other unit is the 2nd unit (shown apart, never on this kit's TX).`);
  if (settings.episodes === 'from_number') items.push('A series: the episode is the number in front of the scene (102 = episode 1).');
  if (settings.scripts?.match) items.push(`Scripts: files named "${settings.scripts.match}…" are read by the robot${settings.kind === 'series' ? '; a new episode script (…EP1…) replaces only that episode' : ''}.`);
  if (settings.sides_by === 'date') items.push("Sides (stralci) are matched to their day by date and scenes, never by the number in their name.");
  if (settings.calendar) items.push(`Phone calendar: ${settings.calendar === 'days_with_2nd_unit' ? 'only the days with a 2nd unit' : 'every shooting day'}.`);
  if (settings.kit) items.push(`Gear: the "${settings.kit}" kit.`);
  if (settings.group_cues?.length) items.push(`Group cues, not a character: ${settings.group_cues.join(', ')}.`);
  if (settings.workday) items.push(`Working day: ${settings.workday} from call to wrap.`);
  if (settings.overtime?.double_after) items.push(`Overtime counts double after the first ${settings.overtime.double_after} min.`);
  if (settings.voices?.language) items.push(`Voices for hearing the lines: ${settings.voices.language}${settings.voices.male ? ` (men: ${settings.voices.male})` : ''}.`);
  return items;
}

function alarmRules(commute) {
  if (!commute) return ['No wake-up plan for this film.'];
  const items = [];
  if (commute.ride_with) items.push(`Riding with ${commute.ride_with}: the alarms follow their call on the ODG${commute.ride_gap_if_unknown ? ` (not printed yet: ${commute.ride_gap_if_unknown} min before yours)` : ''}.`);
  if (commute.days === 'days_with_2nd_unit') items.push('Only the days that also have a 2nd unit (you work the main unit those days).');
  if (commute.walk_to_ride) items.push(`Walk to their house first: ${commute.walk_to_ride} min.`);
  items.push(`${commute.travel === 'maps' ? 'At the crew parking' : 'Meeting point'} ${commute.meet_before_call ?? 45} min before the call.`);
  items.push(commute.travel === 'maps' ? 'Drive: Google Maps for that day and hour (from the ride\'s address, kept only in the robot).' : `Drive: ${commute.travel_min ?? 75}–${commute.travel_max ?? 90} min.`);
  if (commute.rain_penalty) items.push(`Rain or storm in the ODG's weather: +${commute.rain_penalty} min.`);
  if (commute.leave_alarm_before) items.push(`The leave alarm rings ${commute.leave_alarm_before} min before walking out.`);
  items.push(`Getting ready: ${commute.get_ready ?? 45} min · sleep ${commute.sleep_hours ?? 8} h.`);
  return items;
}

export function FilmRulesScreen({ state }) {
  const { project } = state;
  if (!project) return html`<p class="empty">No film open.</p>`;
  const settings = project.settings || {};
  const section = (title, items) => html`
    <h2 class="section-title">${title}</h2>
    <ul class="help">${items.map(text => html`<li>${text}</li>`)}</ul>`;
  return html`
    <div class="help-page">
      <button class="btn" onClick=${() => setState({ screen: 'projects' })}>‹ Projects</button>
      <p class="muted">${project.name}'s own rules. Another film keeps its own.</p>
      ${project.aliases?.length > 0 && html`<p>Also called: <b>${project.aliases.join(', ')}</b></p>`}
      <${ProjectKind} settings=${settings} />
      ${section('Mics', micRules(project))}
      ${section('This film', filmRules(settings))}
      ${section('Alarms', alarmRules(settings.commute))}
      <${CopyRules} project=${project} />
    </div>`;
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

// "Copy rules from another film": pick the film and the groups, then a second tap confirms (film-rules-copy.js)
function CopyRules({ project }) {
  const films = otherFilms();
  const [from, setFrom] = useState('');
  const [groups, setGroups] = useState(['mics']);
  const [asking, setAsking] = useState(false);
  if (!films.length) return html`<p class="muted">No other film on this device to copy rules from.</p>`;
  const toggle = id => setGroups(groups.includes(id) ? groups.filter(g => g !== id) : [...groups, id]);
  const fromName = films.find(f => f.id === from)?.name;
  return html`
    <h2 class="section-title">Copy rules from another film</h2>
    <p class="muted">The groups you tick replace ${project.name}'s. Never copied: the protagonist, the person you ride
      with and your name on the call sheet (they belong to that film).</p>
    <label class="field">From
      <select value=${from} onChange=${e => { setFrom(e.target.value); setAsking(false); }}>
        <option value="">choose a film…</option>
        ${films.map(f => html`<option key=${f.id} value=${f.id}>${f.name}</option>`)}
      </select>
    </label>
    ${RULE_GROUPS.map(g => html`
      <label class="check" key=${g.id}><input type="checkbox" checked=${groups.includes(g.id)} onChange=${() => toggle(g.id)} /> ${g.label}</label>`)}
    ${!asking
      ? html`<button class="btn" disabled=${!from || !groups.length} onClick=${() => setAsking(true)}>Copy rules…</button>`
      : html`<div class="close-film-ask">
          <p>Replace ${project.name}'s <b>${RULE_GROUPS.filter(g => groups.includes(g.id)).map(g => g.id).join(', ')}</b> rules with ${fromName}'s?</p>
          <div class="toolbar">
            <button class="btn btn--primary" onClick=${() => { copyRules(from, groups); setAsking(false); }}>Copy</button>
            <button class="btn" onClick=${() => setAsking(false)}>Cancel</button>
          </div>
        </div>`}`;
}
