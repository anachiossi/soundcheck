// voice-settings.js — Kit → "Read aloud": the film's two voices, a female and a male, chosen from the
// voices of the film's language on this phone, with ▶ to hear each. Saved in the film's settings.json
// (so another film can have another language). Which character uses which: Kit → character → Voice.
// Used by: screens/kit.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { watchVoices, voiceId, voiceLabel, voicesFor, pickVoice, filmVoices, speak } from '../read-aloud.js';
import { saveSettings } from '../kit-editing.js';

const SAMPLE = { it: 'Dai Maura, servila.', en: 'Come on, serve it.', fr: 'Allez, sers-la.', es: 'Venga, sírvela.', pt: 'Vai, serve.' };

export function VoiceSettings({ project }) {
  const [voices, setVoices] = useState([]);
  const [status, setStatus] = useState(''); // what the voice did: speaking · done · no sound (why)
  useEffect(() => watchVoices(setVoices), []);
  const chosen = filmVoices(project);
  const mine = voicesFor(voices, chosen.language);
  const sample = SAMPLE[chosen.language.slice(0, 2)] || SAMPLE.en;

  const choose = (kind, id) => saveSettings({ voices: { ...chosen, [kind]: id } },
    `${kind === 'male' ? 'Male' : 'Female'} voice: ${voiceLabel(mine.find(v => voiceId(v) === id) || { name: id, voiceURI: '' })}.`);
  const names = [...new Set(mine.map(v => v.name))];
  const row = (kind, label) => {
    const current = pickVoice(voices, chosen, kind);
    return html`
      <label class="voice-row">
        <span>${label}</span>
        <select value=${voiceId(current)} onChange=${e => choose(kind, e.target.value)}>
          ${mine.map(v => html`<option key=${voiceId(v)} value=${voiceId(v)}>${voiceLabel(v)}</option>`)}
        </select>
        <button class="btn" type="button" disabled=${!current} aria-label=${`Hear the ${kind} voice`}
                onClick=${() => { setStatus('Starting…'); speak({ text: sample, voice: current, language: chosen.language, onStatus: setStatus }); }}>▶</button>
      </label>`;
  };

  return html`
    <h2 class="section-title">Read aloud <small>${chosen.language}</small></h2>
    ${voices.length === 0 ? html`<p class="muted">Looking for this phone's voices… If nothing comes up, close soundcheck completely (swipe it away) and open it again.</p>`
      : mine.length === 0 ? html`<p class="muted">No ${chosen.language} voices on this phone: add one in Settings → Accessibility → Spoken Content → Voices, then close soundcheck completely and open it again.</p>`
      : html`
        <div class="voices">${row('female', 'Female')}${row('male', 'Male')}</div>
        ${status && html`<p class="voice-status">${status}</p>`}
        ${names.length < 2 && html`<p class="muted">This phone lets web pages use only ${names.join(', ')} for ${chosen.language}:
          the iPhone keeps its other voices (and Siri's) for apps, so the male lines are read by ${names[0]} too.</p>`}
        <p class="muted">For the most natural sound, download the Enhanced or Premium ${chosen.language} voices in
          Settings → Accessibility → Spoken Content → Voices. Each character's voice: tap the character above.
          Just downloaded one and it isn't in the list? Close soundcheck completely and open it again.
          No sound? Check the iPhone's silent switch and the volume.</p>`}`;
}
