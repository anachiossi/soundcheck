// crew-feedback-form.js — on a crew phone only:
//   • FeedbackButton (Projects): "Enjoyed soundcheck? Share some feedback" opens a small form —
//     stars 1–5, "What helped", "What annoyed you", anything else. Send keeps it on the phone and
//     syncs: it goes as soon as there is signal (crew-feedback.js).
//   • FeedbackOffer (under the top bar): once per film, when its last shooting day is 3 days away
//     or less: "The film is wrapping. Enjoyed soundcheck? Share some feedback ›". Offered = remembered
//     on the phone at once, so it never comes back; it stays until tapped or the app is closed.
// The button and the form's buttons sit in a "toolbar" row: the same gaps as the other Projects rows.
// The data changes in crew-device.js, never here. Used by: screens/projects.js, main.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { setState, showMessage } from '../state.js';
import { queueFeedback, markFeedbackOffered } from '../crew-device.js';
import { feedbackDue } from '../crew-feedback.js';
import { syncNow } from '../sync.js';

export function FeedbackButton({ state }) {
  if (!state.feedbackOpen) {
    return html`<div class="toolbar"><button class="btn" onClick=${() => setState({ feedbackOpen: true })}>Enjoyed soundcheck? Share some feedback</button></div>`;
  }
  return html`<${FeedbackForm} state=${state} />`;
}

function FeedbackForm({ state }) {
  const [stars, setStars] = useState(0);
  const [helped, setHelped] = useState('');
  const [annoyed, setAnnoyed] = useState('');
  const [text, setText] = useState('');
  const empty = !stars && !helped.trim() && !annoyed.trim() && !text.trim();

  const send = event => {
    event.preventDefault();
    if (empty) return;
    queueFeedback({ film: state.project.folder, by: state.connection.name, stars,
      helped: helped.trim(), annoyed: annoyed.trim(), text: text.trim(), at: new Date().toISOString() });
    setState({ feedbackOpen: false });
    showMessage('ok', state.online ? 'Thank you! Sending your feedback…' : 'Thank you! Your feedback is saved on this phone and goes at the next sync.');
    syncNow();
  };

  return html`
    <h2 class="section-title">Feedback</h2>
    <form class="form" onSubmit=${send}>
      <p class="muted">How many stars?</p>
      <div class="decision-buttons" role="group" aria-label="Stars">
        ${[1, 2, 3, 4, 5].map(number => html`
          <button type="button" key=${number} class=${number <= stars ? 'btn btn--small btn--primary' : 'btn btn--small'}
                  aria-label=${`${number} of 5`} aria-pressed=${number === stars} onClick=${() => setStars(number)}>
            ${number <= stars ? '★' : '☆'}</button>`)}
      </div>
      <label>What helped<input value=${helped} onInput=${e => setHelped(e.target.value)} /></label>
      <label>What annoyed you<input value=${annoyed} onInput=${e => setAnnoyed(e.target.value)} /></label>
      <label>Anything else<input value=${text} onInput=${e => setText(e.target.value)} /></label>
      <div class="toolbar">
        <button type="button" class="btn" onClick=${() => setState({ feedbackOpen: false })}>Cancel</button>
        <button class="btn btn--primary" disabled=${empty}>Send feedback</button>
      </div>
    </form>`;
}

export function FeedbackOffer({ state }) {
  const [due] = useState(() => feedbackDue(state.project, state.feedbackOffered));
  const [tapped, setTapped] = useState(false);
  useEffect(() => { if (due) markFeedbackOffered(state.project.folder); }, []);
  if (!due || tapped) return null;
  const open = () => {
    setTapped(true);
    setState({ screen: 'projects', feedbackOpen: true });
  };
  return html`
    <button class="proposal-banner" onClick=${open}>
      <b>The film is wrapping.</b>
      <span>Enjoyed soundcheck? Share some feedback ›</span>
    </button>`;
}
