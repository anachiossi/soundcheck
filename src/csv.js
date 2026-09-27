// csv.js — turns CSV text (from Google Sheets) into a list of objects.
// Handles quoted cells, commas and line breaks inside quotes, Windows line
// endings and the invisible "BOM" character some exports start with.
// Used by: store/sheets.js

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  text = text.replace(/^﻿/, '');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else cell += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

  const [header, ...body] = rows.filter(r => r.some(c => c.trim() !== ''));
  if (!header) return [];
  const keys = header.map(k => k.trim());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
