// episodes.js — a series' episodes (Il colpo, 3 Nov: the first series in soundcheck).
// The production numbers scenes with the episode in front: 102 = episode 1, scene 02; 438 = episode 4,
// scene 38; 526Dparte = episode 5. The number stays exactly as the ODG, PDL and sides print it (that's
// how everyone on set says it); the episode is only used to group the scenes.
// A film is a series when its settings say "episodes": "from_number". A scene can also say its own
// episode in scenes.json ("episode": 5), which wins (e.g. a rewritten scene filed in another episode).
// Used by: screens/scenes.js

import { naturalCompare } from './model.js';

// 102 → 1 · 667 → 6 · 1012 → 10 · '526Dparte' → 5; null when the film has no episodes
export function episodeOf(project, sceneId) {
  const own = project.scenes?.[String(sceneId)]?.episode;
  if (own) return Number(own);
  if (project.settings?.episodes !== 'from_number') return null;
  const number = parseInt(String(sceneId), 10);
  return Number.isFinite(number) && number >= 100 ? Math.floor(number / 100) : null;
}

// [{ episode: 1, ids: ['101', '102'] }, …, { episode: null, ids: [...] }] in episode order; null = not a series
export function byEpisode(project, sceneIds) {
  if (!sceneIds.some(id => episodeOf(project, id) !== null)) return null;
  const groups = new Map();
  for (const id of sceneIds) {
    const episode = episodeOf(project, id);
    if (!groups.has(episode)) groups.set(episode, []);
    groups.get(episode).push(id);
  }
  return [...groups].map(([episode, ids]) => ({ episode, ids: ids.sort(naturalCompare) }))
    .sort((a, b) => (a.episode ?? 999) - (b.episode ?? 999));
}
