// manuals.js — the equipment manuals of a film (Ana, 2 Oct): PDFs in the film's data
// (docs/manuals/<brand>/…, kept on the device for offline reading like the ODGs) and the list
// gear/manuals.json [{ brand, category, title, date, file, models }] that says which models each one covers.
// category (v150, Ana 13 Oct): "Schoeps — Microphones"; a brand with several gets one sub-heading each
// (Sennheiser: Wireless, Headphones, Microphones…).
// Used by: screens/gear.js (Gear → Manuals, by brand), screens/kit.js (📄 under the transmitters)

import { setState } from './state.js';

export const manualsOf = project => project.gearManuals || [];

// { 'Sennheiser': { 'Wireless': [manual, …], 'Headphones': […] } }, brands A–Z, categories A–Z
export function manualsByBrand(project) {
  const brands = {};
  for (const manual of manualsOf(project)) ((brands[manual.brand || 'Other'] ||= {})[manual.category || 'Other'] ||= []).push(manual);
  const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  return Object.fromEntries(Object.entries(sorted(brands)).map(([brand, categories]) => [brand, sorted(categories)]));
}

// the manuals for some models (e.g. the kit's TX models), each once
export function manualsForModels(project, models) {
  const wanted = new Set(models.map(m => String(m).toLowerCase()));
  return manualsOf(project).filter(manual => (manual.models || []).some(m => wanted.has(String(m).toLowerCase())));
}

// the PDF's path on the device ('' while it hasn't been downloaded yet)
export const manualPath = (project, manual) => (project.documents?.[`${project.folder}/${manual.file}`] ? `${project.folder}/${manual.file}` : '');

export function openManual(project, manual, from) {
  const path = manualPath(project, manual);
  if (!path) return;
  setState({ screen: 'document', documentPath: path, documentTitle: `${manual.brand} ${manual.title}`,
    documentFile: `MANUAL-${manual.brand}-${manual.title}.pdf`.replace(/[^\w.-]+/g, '-'), documentFrom: from });
}
