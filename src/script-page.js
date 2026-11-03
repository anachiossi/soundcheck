// script-page.js — where a scene is in the official script PDF, for the 📄 button on its slate (Ana, 3 Nov: "a button
// to link to that scene in the official script"). pipeline/cue_lines.py writes "pdf" + "page" in
// lines/script/<scene>.json; a production split (526Dparte, 330A) uses its script scene (526, 330) like Cues does.
// Used by: parts/scene-table.js, screens/projects.js

import { setState, getState } from './state.js';

// { path: '<film folder>/docs/scripts/ep2.pdf', page: 10, title: 'Script Ep 2 · 208' } — or null when not on this device
export function scriptPage(project, sceneId) {
  const id = String(sceneId);
  const base = id.match(/^\d+/)?.[0];
  const entry = project.lines?.[`script/${id}`] || (base && project.lines?.[`script/${base}`]);
  if (!entry?.pdf || !entry.page) return null;
  const path = `${project.folder}/${entry.pdf}`;
  if (!project.documents?.[path]) return null; // the PDF is not on this device yet
  const episode = entry.pdf.match(/ep(\d+)\.pdf$/)?.[1];
  return { path, page: entry.page, title: `Script${episode ? ` Ep ${episode}` : ''} · ${entry.scene_id || base || id}` };
}

export function openScriptPage(found) {
  setState({ screen: 'document', documentPath: found.path, documentTitle: found.title, documentPage: found.page,
    documentFile: `${found.title.replace(/[\s·]+/g, '_')}.pdf`, documentFrom: getState().screen });
}

// the film's episode scripts on this device: [{ episode: '1', path, title }] (Projects → 📄 Ep 1…)
export function episodeScripts(project) {
  const prefix = `${project.folder}/docs/scripts/`;
  return Object.keys(project.documents || {})
    .filter(path => path.startsWith(prefix) && /ep(\d+)\.pdf$/.test(path))
    .map(path => ({ episode: path.match(/ep(\d+)\.pdf$/)[1], path }))
    .sort((a, b) => Number(a.episode) - Number(b.episode));
}
