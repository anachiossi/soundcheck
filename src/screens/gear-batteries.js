// gear-batteries.js — Gear → Batteries: every battery of the film, by group (AA, NP-F970…), always in
// green / yellow / red (battery-rules.js). Tap a battery: Full · Charging (on which charger) · In use (where) ·
// Empty; its clock starts. Leaving a TX it asks how it ended (Dead · Low · Still OK): the estimate learns.
// "+ Group": a name, how many (numbered 1…), the estimated minutes in use (per TX model too) and on the charger.
// "+ Charger": a name, the group it charges, slots, minutes for a full charge.
// No notifications yet (Ana, 12 Oct: "once we have the aesthetics right we can think of notification triggering").
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { STATES, ENDS, batteryFile, batteryGroups, timeLeft, toneOf, clock, countsOf, lifeOf, chargerLoad, txOf, wearerOf } from '../battery-rules.js';
import { setBattery, saveGroup, saveCharger } from '../battery-editing.js';
import { naturalCompare } from '../model.js';
import { Sheet } from '../parts/gear-form.js';
import { useMinuteClock } from '../parts/battery-tag.js';

const TONE_OF_STATE = { full: 'green', charging: 'yellow', in_use: '', empty: 'red' };

// 'TX 7 · Gianni' for a battery in a TX worn today
function placeLabel(project, battery, now) {
  const tx = txOf(project, battery.used_in);
  const wearer = tx && wearerOf(project, tx.id, now);
  return [battery.used_in || 'in use', wearer?.name].filter(Boolean).join(' · ');
}

export function GearBatteriesScreen({ state }) {
  const { project } = state;
  const now = useMinuteClock();
  const [battery, setOpenBattery] = useState(null);
  const [group, setOpenGroup] = useState(null);
  const [charger, setOpenCharger] = useState(null);
  const groups = batteryGroups(project);
  const { chargers } = batteryFile(project);
  return html`
    <div class="gear">
      ${groups.length === 0 && html`<p class="empty">No batteries yet. "+ Group" for each kind: AA ×20, NP-F970 ×5…</p>`}
      ${groups.map(g => {
        const counts = countsOf(g.batteries);
        return html`
          <section class="battery-group" key=${g.id}>
            <header class="battery-group__head">
              <button class="link" onClick=${() => setOpenGroup({ ...g, count: g.batteries.length })}><b>${g.name}</b></button>
              ${STATES.filter(([s]) => counts[s]).map(([s, label]) => html`
                <span key=${s} class=${`chip chip--static battery--${TONE_OF_STATE[s] || 'plain'}`}>${counts[s]} ${label.toLowerCase()}</span>`)}
            </header>
            <div class="battery-grid">
              ${g.batteries.map(b => {
                const time = timeLeft(b, g, now, project);
                return html`
                  <button key=${b.id} class=${`battery battery--${toneOf(b, g, now, project)}`} onClick=${() => setOpenBattery({ battery: b, group: g })}>
                    <b>${b.label}</b>
                    <small>${b.state === 'in_use' ? placeLabel(project, b, now) : b.state === 'charging' ? 'charging' : b.state === 'full' ? 'full' : 'empty'}</small>
                    ${time && html`<small class="battery__time">${time.left ? clock(time.left) : b.state === 'charging' ? 'done?' : '0:00'}</small>`}
                  </button>`;
              })}
            </div>
            ${chargers.some(c => c.group === g.id) && html`
              <div class="battery-chargers">${chargers.filter(c => c.group === g.id).map(c => html`
                <button key=${c.id} class="chip chip--static" onClick=${() => setOpenCharger(c)}>
                  🔌 ${c.name} ${chargerLoad(project, c.id)}${c.slots ? `/${c.slots}` : ''}</button>`)}</div>`}
          </section>`;
      })}
      ${chargers.some(c => !groups.some(g => g.id === c.group)) && html`
        <div class="battery-chargers">${chargers.filter(c => !groups.some(g => g.id === c.group)).map(c => html`
          <button key=${c.id} class="chip chip--static" onClick=${() => setOpenCharger(c)}>
            🔌 ${c.name} ${chargerLoad(project, c.id)}${c.slots ? `/${c.slots}` : ''}</button>`)}</div>`}
      <div class="toolbar">
        <button class="btn btn--quiet" onClick=${() => setOpenGroup({})}>+ Group</button>
        <button class="btn btn--quiet" onClick=${() => setOpenCharger({})}>+ Charger</button>
      </div>
      ${battery && html`<${BatterySheet} project=${project} now=${now} ...${battery} close=${() => setOpenBattery(null)} />`}
      ${group && html`<${GroupSheet} project=${project} group=${group} close=${() => setOpenGroup(null)} />`}
      ${charger && html`<${ChargerSheet} groups=${groups} charger=${charger} close=${() => setOpenCharger(null)} />`}
    </div>`;
}

// where a battery can be in use: the TXs, boom plug-ons and IFB receivers of the film, and the places a
// group has its own minutes for (Mars 4K TX…)
const placesOf = (project, group) => [...new Set([
  ...Object.keys(group?.models || {}).filter(key => !txOf(project, key) && !(project.transmitters || []).some(t => t.model === key)),
  ...(project.transmitters || []).map(t => (/^\d+$/.test(t.id) ? `TX ${t.id}` : t.id)),
  ...(project.ifbReceivers || []).map(r => `RX ${r.id}`),
])];

function BatterySheet({ project, now, battery, group, close }) {
  const [values, setValues] = useState({ state: battery.state, used_in: battery.used_in || '', charger: battery.charger || '',
    charge_min: battery.charge_min ?? '', life_pct: battery.life_pct ?? '', end: '' });
  const set = (key, value) => setValues({ ...values, [key]: value });
  const chargers = batteryFile(project).chargers.filter(c => !c.group || c.group === group.id);
  const leaving = battery.state === 'in_use' && values.state !== 'in_use';
  const tx = battery.state === 'in_use' && txOf(project, battery.used_in);
  const wearer = tx && wearerOf(project, tx.id, now);
  const life = battery.state === 'in_use' && lifeOf(project, battery, group, now);
  const submit = e => {
    e.preventDefault();
    const fields = { state: values.state, life_pct: values.life_pct === '' ? undefined : Math.max(1, Math.round(Number(values.life_pct) || 100)) };
    if (values.state === 'in_use') fields.used_in = values.used_in.trim();
    if (values.state === 'charging') {
      fields.charger = values.charger || undefined;
      fields.charge_min = values.charge_min === '' ? undefined : Number(values.charge_min);
    }
    setBattery(battery.id, fields, leaving ? values.end : undefined);
    close();
  };
  return html`<${Sheet} title=${`${group.name} ${battery.label}`} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      ${tx && html`<p class="muted">${battery.used_in}${wearer ? ` · ${wearer.name}${wearer.actor ? ` (${wearer.actor})` : ''}` : ''}
        ${life && html`<br />${life.notes.join(' · ')} → ${clock(life.minutes)}`}</p>`}
      <div class="choices">
        ${STATES.map(([s, label]) => html`<button type="button" key=${s} class=${'choice' + (values.state === s ? ' choice--on' : '')}
          onClick=${() => set('state', s)}>${label}</button>`)}
      </div>
      ${leaving && html`
        <p class="sheet__hint">How did it end?</p>
        <div class="choices">
          ${ENDS.map(([end, label]) => html`<button type="button" key=${end} class=${'choice' + (values.end === end ? ' choice--on' : '')}
            onClick=${() => set('end', values.end === end ? '' : end)}>${label}</button>`)}
        </div>`}
      ${values.state === 'in_use' && html`
        <label><span>In</span><input list="battery-places" value=${values.used_in} placeholder="TX 7, B1, Hollyland…" onInput=${e => set('used_in', e.target.value)} />
          <datalist id="battery-places">${placesOf(project, group).map(p => html`<option key=${p} value=${p} />`)}</datalist></label>`}
      ${values.state === 'charging' && chargers.length > 0 && html`
        <div class="choices">
          ${chargers.map(c => {
            const load = chargerLoad(project, c.id) - (battery.charger === c.id && battery.state === 'charging' ? 1 : 0);
            return html`<button type="button" key=${c.id} class=${'choice' + (values.charger === c.id ? ' choice--on' : '')}
              onClick=${() => set('charger', values.charger === c.id ? '' : c.id)}>🔌 ${c.name} ${load}${c.slots ? `/${c.slots}` : ''}</button>`;
          })}
        </div>`}
      ${values.state === 'charging' && html`
        <label><span>Minutes on the charger (this time only)</span><input type="number" min="0" value=${values.charge_min}
          placeholder="the charger's or the group's" onInput=${e => set('charge_min', e.target.value)} /></label>`}
      <label><span>Life % (old ones less than 100)</span><input type="number" min="1" max="200" value=${values.life_pct}
        placeholder="100" onInput=${e => set('life_pct', e.target.value)} /></label>
      <button class="btn btn--primary">Save</button>
    </form></${Sheet}>`;
}

function GroupSheet({ project, group, close }) {
  const [values, setValues] = useState({ name: group.name || '', count: group.count || '', life_min: group.life_min ?? '',
    charge_min: group.charge_min ?? '', models: { ...group.models } });
  const set = (key, value) => setValues({ ...values, [key]: value });
  // the group's own places (Mars 4K TX…), else the TX models
  const own = Object.keys(group.models || {});
  const models = own.length ? own : [...new Set((project.transmitters || []).map(t => t.model).filter(Boolean))].sort(naturalCompare);
  const submit = e => { e.preventDefault(); saveGroup({ ...values, id: group.id }); close(); };
  return html`<${Sheet} title=${group.id ? group.name : 'New group'} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      <label><span>Name</span><input value=${values.name} placeholder="AA, NP-F970…" onInput=${e => set('name', e.target.value)} required autofocus=${!group.id} /></label>
      <label><span>How many (numbered 1…)</span><input type="number" min=${group.count || 0} value=${values.count} onInput=${e => set('count', e.target.value)} /></label>
      <label><span>Minutes in use (estimate)</span><input type="number" min="0" value=${values.life_min} onInput=${e => set('life_min', e.target.value)} /></label>
      <label><span>Minutes to charge (estimate)</span><input type="number" min="0" value=${values.charge_min} onInput=${e => set('charge_min', e.target.value)} /></label>
      ${models.length > 0 && html`
        <p class="sheet__hint">Minutes by model or place (empty: the group's)</p>
        ${models.map(m => html`<label key=${m}><span>${m}</span><input type="number" min="0" value=${values.models[m] ?? ''}
          onInput=${e => set('models', { ...values.models, [m]: e.target.value })} /></label>`)}`}
      <button class="btn btn--primary">Save</button>
    </form></${Sheet}>`;
}

function ChargerSheet({ groups, charger, close }) {
  const [values, setValues] = useState({ name: charger.name || '', group: charger.group || '', slots: charger.slots ?? '', charge_min: charger.charge_min ?? '' });
  const set = (key, value) => setValues({ ...values, [key]: value });
  const submit = e => { e.preventDefault(); saveCharger({ ...values, id: charger.id }); close(); };
  return html`<${Sheet} title=${charger.id ? charger.name : 'New charger'} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      <label><span>Name</span><input value=${values.name} placeholder="Zaxcom AA charger…" onInput=${e => set('name', e.target.value)} required autofocus=${!charger.id} /></label>
      ${groups.length > 0 && html`
        <p class="sheet__hint">Charges</p>
        <div class="choices">${groups.map(g => html`<button type="button" key=${g.id} class=${'choice' + (values.group === g.id ? ' choice--on' : '')}
          onClick=${() => set('group', values.group === g.id ? '' : g.id)}>${g.name}</button>`)}</div>`}
      <label><span>Slots</span><input type="number" min="1" value=${values.slots} onInput=${e => set('slots', e.target.value)} /></label>
      <label><span>Minutes for a full charge</span><input type="number" min="0" value=${values.charge_min} onInput=${e => set('charge_min', e.target.value)} /></label>
      <button class="btn btn--primary">Save</button>
    </form></${Sheet}>`;
}
