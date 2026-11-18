// lav-rules.js — Mics → Presets: who gets a mic and which one, to change here (Ana, 18 Nov). Each choice is saved at
// once in the film's settings.json; the robot uses it on the next ODG. Mics already in a scene don't change.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { showMessage } from '../state.js';
import { lavModels, lavName, readTxOrder, saveLavRules, txIds, txModels } from '../lav-rules.js';

const WHO = [['', 'Only who speaks'], ['recurring', 'Main and medium characters, even when silent'],
  ['cast', 'Every actor, even when silent (not extras or special extras)']];

function Choice({ label, value, options, empty, onChange }) {
  return html`
    <label class="field">${label}
      <select value=${value || ''} onChange=${event => onChange(event.target.value)}>
        ${empty && html`<option value="">${empty}</option>`}
        ${options.map(([id, name]) => html`<option key=${id} value=${id}>${name}</option>`)}
      </select>
    </label>`;
}

function Ticks({ items, chosen, onChange }) {
  const toggle = id => onChange(chosen.includes(id) ? chosen.filter(other => other !== id) : [...chosen, id]);
  return html`
    <div class="lav-rules__ticks">
      ${items.map(([id, name]) => html`
        <label class="check" key=${id}><input type="checkbox" checked=${chosen.includes(id)} onChange=${() => toggle(id)} /> ${name}</label>`)}
    </div>`;
}

export function LavRulesScreen({ state }) {
  const { project } = state;
  const rules = project.settings?.presets || {};
  const lav = rules.lav_rules || {};
  const models = lavModels(project).map(model => [model, lavName(model)]);
  const save = (changes, message) => saveLavRules(project, changes, message);
  const gender = (code, model) => save({ lav: { by_gender: { ...lav.by_gender, [code]: model } } }, 'Lav rule saved.');
  const forTx = (tx, model) => save({ lav: { lav_for_tx_model: { ...lav.lav_for_tx_model, [tx]: model } } }, 'Lav rule saved.');
  const booms = rules.not_for_actors || [];
  const setBooms = chosen => save({ not_for_actors: chosen, tx_order: (rules.tx_order || []).filter(id => !chosen.includes(id)) }, 'TX rule saved.');

  return html`
    <div class="help-page lav-rules">
      <p class="muted">The robot follows these on every new ODG. A character keeps the same TX and lav all day.</p>

      <h2 class="section-title">Who gets a mic</h2>
      <${Choice} label="A TX and a lav for" value=${rules.wire_silent} options=${WHO}
        onChange=${value => save({ wire_silent: value }, 'Who gets a mic: saved.')} />
      <${Choice} label="Protagonist (always wired, keeps the same TX)" value=${String(rules.protagonist ?? '')} empty="No protagonist"
        options=${project.characters.map(character => [character.id, character.name])}
        onChange=${value => save({ protagonist: value }, 'Protagonist saved.')} />

      <h2 class="section-title">Lavs</h2>
      <${Choice} label="Women" value=${lav.by_gender?.F} empty="No rule" options=${models} onChange=${value => gender('F', value)} />
      <${Choice} label="Men" value=${lav.by_gender?.M} empty="No rule" options=${models} onChange=${value => gender('M', value)} />
      <${Choice} label="Screamers" value=${lav.loud} empty="No rule" options=${models}
        onChange=${value => save({ lav: { loud: value } }, 'Lav rule saved.')} />
      ${txModels(project).map(tx => html`
        <${Choice} key=${tx} label=${`With a ${tx} TX, always`} value=${lav.lav_for_tx_model?.[tx]} empty="No rule" options=${models}
          onChange=${value => forTx(tx, value)} />`)}
      <p class="field">Never used</p>
      <${Ticks} items=${models} chosen=${lav.not_used || []} onChange=${chosen => save({ lav: { not_used: chosen } }, 'Lav rule saved.')} />

      <h2 class="section-title">Transmitters</h2>
      <${TxOrder} key=${(rules.tx_order || []).join()} project=${project} rules=${rules} booms=${booms} />
      <${Exceptions} label="Never on an actor (the booms)" items=${txIds(project)} chosen=${booms} onChange=${setBooms} />
    </div>`;
}

// The TX kept off the actors: one small tag each (✕ takes it off) and a list to add another.
function Exceptions({ label, items, chosen, onChange }) {
  const left = items.filter(id => !chosen.includes(id));
  return html`
    <label class="field">${label}
      <select value="" onChange=${event => event.target.value && onChange([...chosen, event.target.value])}>
        <option value="">Add a TX…</option>
        ${left.map(id => html`<option key=${id} value=${id}>TX ${id}</option>`)}
      </select>
    </label>
    <div class="chips">
      ${chosen.map(id => html`
        <button key=${id} class="chip chip--on" aria-label=${`Take TX ${id} off the list`}
                onClick=${() => onChange(chosen.filter(other => other !== id))}>TX ${id} ✕</button>`)}
    </div>`;
}

function TxOrder({ project, rules, booms }) {
  const [text, setText] = useState((rules.tx_order || []).join(', '));
  const submit = event => {
    event.preventDefault();
    const { order, unknown, booms: onBooms } = readTxOrder(text, project, booms);
    if (unknown.length) return showMessage('error', `Not in the kit: TX ${unknown.join(', ')}.`);
    if (onBooms.length) return showMessage('error', `TX ${onBooms.join(', ')} is kept for the booms: untick it first.`);
    saveLavRules(project, { tx_order: order }, 'TX order saved.');
  };
  return html`
    <form class="field" onSubmit=${submit}>TX order (who comes first takes the first one)
      <span class="toolbar"><input value=${text} onInput=${event => setText(event.target.value)} placeholder="1, 2, 3" />
        <button class="btn btn--small">Save</button></span>
    </form>`;
}
