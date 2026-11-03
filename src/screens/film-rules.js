// film-rules.js — the Film rules page (Projects → 📋 Film rules): every rule this film's robots and preset
// generator follow, in plain words, so Ana can recall them (3 Nov, Il colpo: "make a settings page for these
// rules so I can recall eventually"). Read-only: the rules live in the film's settings.json (each film its own).
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';

const LAV_NAMES = { cos11: 'Sanken COS-11', 6060: 'DPA 6060', 6061: 'DPA 6061', 4060: 'DPA 4060', 4061: 'DPA 4061' };
const lavName = model => LAV_NAMES[model] || model;
const GENDER = { F: 'women', M: 'men' };

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
  if (rules.small_day_max_speakers) items.push(`A "small day" has at most ${rules.small_day_max_speakers} speakers per scene.`);
  return items;
}

function filmRules(settings) {
  const items = [];
  if (settings.main_unit) items.push(`Main unit: "${settings.main_unit}" on the ODG; any other unit is the 2nd unit (shown apart, never on this kit's TX).`);
  if (settings.episodes === 'from_number') items.push('A series: the episode is the number in front of the scene (102 = episode 1).');
  if (settings.sides_by === 'date') items.push("Sides (stralci) are matched to their day by date and scenes, never by the number in their name.");
  if (settings.calendar) items.push(`Phone calendar: ${settings.calendar === 'days_with_2nd_unit' ? 'only the days with a 2nd unit' : 'every shooting day'}.`);
  if (settings.kit) items.push(`Gear: the "${settings.kit}" kit.`);
  return items;
}

function alarmRules(commute) {
  if (!commute) return ['No wake-up plan for this film.'];
  const items = [];
  if (commute.ride_with) items.push(`Riding with ${commute.ride_with}: the alarms follow their call on the ODG.`);
  if (commute.walk_to_ride) items.push(`Walk to their house first: ${commute.walk_to_ride} min.`);
  items.push(`At the crew parking ${commute.meet_before_call ?? 45} min before the call.`);
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
      ${section('Mics', micRules(project))}
      ${section('This film', filmRules(settings))}
      ${section('Alarms', alarmRules(settings.commute))}
    </div>`;
}
