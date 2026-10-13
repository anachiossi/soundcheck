// image-for.js — before a mic-list image, one question (Ana, 13 Oct: "image for sound mixer or for sound assistants?").
// The app itself always shows every column; only the image differs (export/image.js):
//   Sound mixer:      Character · TX · Lav · Speaks
//   Sound assistants: Character · TX + MHz · Change at · Lav · Lav acc. · TX acc. · Position
//   const audience = await askImageFor(); if (!audience) return;   // 'mixer' | 'assistants' | null (closed)
// Used by: main.js (the sheet), screens/schedule.js, screens/scenes.js, screens/lav-share.js

import { html } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';
import { Sheet } from './gear-form.js';

export const askImageFor = () => new Promise(resolve => setState({ imageFor: resolve }));

export function ImageForQuestion({ state }) {
  const resolve = state.imageFor;
  if (!resolve) return null;
  const answer = audience => { setState({ imageFor: null }); resolve(audience); };
  return html`<${Sheet} title="Image for" close=${() => answer(null)}>
    <div class="toolbar">
      <button class="btn btn--primary" onClick=${() => answer('mixer')}>Sound mixer</button>
      <button class="btn btn--primary" onClick=${() => answer('assistants')}>Sound assistants</button>
    </div>
  <//>`;
}
