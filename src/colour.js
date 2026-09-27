// colour.js — picks black or white text for any background colour, so names
// stay readable on every character colour (one formula for the whole app).
// Used by: parts/pills.js, export/image.js

export function textColourFor(background) {
  const rgb = hexToRgb(background);
  if (!rgb) return '#0f172a';
  // WCAG relative luminance
  const [r, g, b] = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#0f172a' : '#ffffff';
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

// Colours so pale they vanish on white (e.g. TX "#e9e9e9") count as "no colour".
export function isNearWhite(hex) {
  const rgb = hexToRgb(hex);
  return !rgb || rgb.every(v => v > 225);
}
