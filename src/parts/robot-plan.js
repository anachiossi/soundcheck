// robot-plan.js — what the Hours card (parts/tomorrow.js) and the alarm page (screens/alarms.js) share: the robot's plan
// for the next shooting day, its times on screen, and the link that hands them to the iPhone. The times are the robot's
// (pipeline/gmail-trigger.gs planAnswer): nothing is worked out here, so the app and the alarms can never disagree.
// Used by: parts/tomorrow.js, screens/alarms.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { askPlan, keptPlan, robotLink } from '../robot-link.js';

export const SHORTCUT = 'soundcheck alarms';
const ASK_AFTER = 800; // ms after the last change on the alarm page: Google is asked once, not at every key
const DAY = 24 * 3600 * 1000;

// shortcuts://run-shortcut?name=soundcheck%20alarms&input=text&text=06:00;Il colpo · D59 · 09/11/2026;06:45 — the robot's
// answer as it is: the shortcut takes the First Item (wake) and the Last Item (leave), the name is in the middle
export const alarmsLink = plan =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT)}&input=text&text=${encodeURIComponent(plan.answer)}`;

// an iPhone alarm is a time of day: it can be set only when the wake is still ahead and within 24 hours
export function canSetAlarms(plan, now = new Date()) {
  const away = new Date(plan?.wakeAt).getTime() - now.getTime();
  return away > 0 && away <= DAY;
}

const PROBLEMS = {
  'no signal': 'No signal: showing the last answer kept on this phone.',
  'old robot': 'The robot needs its new version: publish it from the computer.',
};
export const problemText = problem => PROBLEMS[problem] || (problem ? `The robot said: ${problem}` : '');

// the robot's plan: at once the one kept on this phone, then the fresh answer.
// choices: the alarm page's values (null on the card). refresh: asks again when it changes (a sync has finished).
export function useRobotPlan(project, choices, refresh) {
  const [plan, setPlan] = useState(() => keptPlan(project));
  const [answered, setAnswered] = useState(null); // the question the plan on screen answers
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState('');
  const question = JSON.stringify(choices);

  useEffect(() => {
    if (!robotLink()) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAsking(true);
      const answer = await askPlan(project, choices || undefined);
      if (cancelled) return;
      setAsking(false);
      setProblem(answer.error || '');
      if (!answer.error) { setPlan(answer); setAnswered(question); }
    }, choices ? ASK_AFTER : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project.folder, question, refresh]);

  return { plan, asking, problem, current: answered === question };
}

export const askedAt = plan => (plan?.asked_at ? new Date(plan.asked_at).toTimeString().slice(0, 5) : '');
