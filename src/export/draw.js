// draw.js — tiny drawing helpers for the exported images (canvas).
// Rounded boxes, text that is cut with "…" when too long, and a pill.
// Used by: export/image.js

import { textColourFor, isNearWhite } from '../colour.js';

export const FONT = 'Inter, system-ui, sans-serif';

export function font(ctx, weight, size) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

export function box(ctx, x, y, w, h, radius, fill, stroke, lineWidth = 3) {
  ctx.beginPath();
  const r = Math.min(radius, h / 2, w / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

export function text(ctx, value, x, y, maxWidth, colour = '#0f172a', align = 'left') {
  let s = String(value ?? '');
  if (maxWidth) {
    while (s.length > 1 && ctx.measureText(s).width > maxWidth) s = s.slice(0, -1);
    if (s !== String(value ?? '')) s = s.slice(0, -1) + '…';
  }
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

// Splits a sentence into lines that fit maxWidth (uses the current ctx font).
export function wrapLines(ctx, value, maxWidth, maxLines = 3) {
  const lines = [];
  let line = '';
  for (const word of String(value || '').split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] += ' …';
  }
  return lines;
}

// A small rounded label like INT or Notte; returns its width.
export function tag(ctx, value, x, y, fill, colour) {
  font(ctx, 800, 24);
  const w = ctx.measureText(value).width + 28;
  box(ctx, x, y, w, 42, 8, fill);
  text(ctx, value, x + 14, y + 22, 0, colour);
  return w;
}

// A coloured pill with one bold line and an optional small second line.
export function pill(ctx, x, y, w, h, colour, main, sub, { outline } = {}) {
  const bg = colour && !isNearWhite(colour) ? colour : '#f1f5f9';
  const fg = textColourFor(bg);
  box(ctx, x, y, w, h, h / 2, bg, outline);
  font(ctx, 800, 30);
  if (sub) {
    text(ctx, main, x + 24, y + h * 0.36, w - 40, fg);
    font(ctx, 400, 22);
    text(ctx, sub, x + 24, y + h * 0.72, w - 40, fg);
  } else {
    text(ctx, main, x + w / 2, y + h / 2, w - 20, fg, 'center');
  }
}

export function newCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}
