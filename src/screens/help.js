// help.js — the Help page (Projects → Help): how to set things up and the tips that used to sit
// on the screens themselves, so those keep only their controls.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';

export function HelpScreen() {
  return html`
    <div class="help-page">
      <button class="btn" onClick=${() => setState({ screen: 'projects' })}>‹ Projects</button>

      <h2 class="section-title">Use it offline</h2>
      <ol class="help">
        <li>iPhone/iPad: open this page in Safari → Share → <b>Add to Home Screen</b>, and use the icon from then on.</li>
        <li>Inside the Home Screen app, connect and download the film (it keeps its own storage, separate from Safari).</li>
        <li>Check it opens in flight mode ✈. Changes made offline upload by themselves when signal returns.</li>
      </ol>

      <h2 class="section-title">Screen</h2>
      <p>Projects → Screen: <b>Auto</b> follows the phone's own light / dark setting. <b>Dark</b> is easier on the eyes on night sets.</p>

      <h2 class="section-title">Wrap hours</h2>
      <ul class="help">
        <li>The ⏱ in the top bar counts down to the ODG's wrap, then counts the overtime (+0h 35m).</li>
        <li>After the wrap: "Did today finish on time?" — No asks again every hour ("Is this a wrap?") until you type the real wrap.</li>
        <li>Tap ⏱ (or Projects → ⏱ Hours, any day) for the week, the overtime, and the images for production (week or whole film). Tap a day's wrap to correct it.</li>
        <li><b>Notifications</b> at the wrap, even with the app closed: Hours → 🔔 Wrap alerts → Allow (Home Screen app, iOS 16.4 or later). They can come up to 10 minutes late.</li>
      </ul>

      <h2 class="section-title">Alarms for the next day</h2>
      <p>Projects → ⏱ Hours shows, for the next shooting day: when to sleep, wake up, leave and be at the meeting
        point (the numbers are set per film, under "Wake-up plan"). <b>⏰ Set alarms</b> creates the wake-up and
        leave alarms in the iPhone's Clock through a shortcut. Make the shortcut once, in the Shortcuts app:</p>
      <ol class="help">
        <li>New shortcut, named exactly <b>soundcheck alarms</b>.</li>
        <li><b>First, clear yesterday's:</b> add <b>Find Alarms</b> (Clock) where <b>Label contains</b> <code>soundcheck</code>,
          then <b>Delete Alarms</b> with them. (If your iPhone has no delete action: <b>Toggle Alarm</b> → Off, so
          the old ones never ring.) Your other alarms aren't touched.</li>
        <li>Add <b>Split Text</b>: split the <b>Shortcut Input</b> by <b>Custom</b> <code>;</code></li>
        <li>Add <b>Get Item from List</b> → <b>First Item</b> of Split Text, then <b>Create Alarm</b> (Clock):
          time = that item, label <b>soundcheck · Wake up</b>.</li>
        <li>Add <b>Get Item from List</b> → <b>Item at Index 2</b> of Split Text, then <b>Create Alarm</b>:
          time = that item, label <b>soundcheck · Leave home</b>.</li>
        <li>In the shortcut's settings (ⓘ), turn off "Show When Run" if you like.</li>
      </ol>
      <p class="muted">The robot also sends a notification when tomorrow's ODG arrives, and one at bedtime 💤.</p>

      <h2 class="section-title">Hearing the lines</h2>
      <ul class="help">
        <li>🔊 in Cues and the Timeline reads the scene with the phone's voice, a short pause between lines.
          The iPhone gives web apps one voice per language; no sound? Check the silent switch.</li>
        <li>With Siri's voice: open Cues on the first line and swipe down with two fingers from the top (Speak Screen,
          turn it on in Settings → Accessibility → Spoken Content). It reads each character's name, then the line,
          to the end of the scene. Don't tap while it reads.</li>
      </ul>
    </div>`;
}
