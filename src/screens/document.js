// document.js — reads a day's PDF (ODG, sides, map, other papers) from the copy kept on the device,
// (a map sent as a photo is shown as a picture),
// so it opens with no signal. Pages are drawn one under the other, as wide as the
// screen; pinch to zoom the pages only (parts/pinch-zoom.js: the bar on top keeps its size). "Share" hands the PDF to the phone (Files, Books, WhatsApp…).
// The PDF drawing uses pdf.js (vendor/pdfjs), loaded only when a document is opened.
// Used by: main.js (opened from the 📄 buttons in the Schedule)

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { showScreen, getState, setState } from '../state.js';
import { exportName } from '../model.js';
import { loadDocument } from '../store/local.js';
import { shareFile } from '../export/share.js';
import { usePinchZoom } from '../parts/pinch-zoom.js';

// goTo: the page to show first (a scene's page in the script, script-page.js): the screen scrolls there as soon
// as that page is drawn; the pages before it are drawn too, so you can scroll back
async function drawPages(blob, holder, isCancelled, goTo) {
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  holder.innerHTML = ''; // the pages are drawings, not app data: drawn straight into the page
  for (let number = 1; number <= pdf.numPages && !isCancelled(); number++) {
    const page = await pdf.getPage(number);
    const scale = (holder.clientWidth / page.getViewport({ scale: 1 }).width) * Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    const viewport = page.getViewport({ scale });
    const canvas = Object.assign(document.createElement('canvas'), { width: viewport.width, height: viewport.height });
    canvas.className = 'pdf-page';
    holder.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (number === goTo) canvas.scrollIntoView({ block: 'start' });
  }
}

export function DocumentScreen({ state }) {
  const { project, documentPath, documentTitle } = state;
  const holder = useRef(null);
  const zoomBox = useRef(null);
  const [zoom, resetZoom] = usePinchZoom(zoomBox);
  const [problem, setProblem] = useState('');
  const [blob, setBlob] = useState(null);
  const [picture, setPicture] = useState(''); // a map sent as a photo: its address on this device

  useEffect(() => {
    let cancelled = false;
    let address = '';
    setProblem('');
    setPicture('');
    loadDocument(project.id, documentPath)
      .then(found => {
        if (!found) throw new Error('This document is not on this device yet. Open the app once with signal.');
        setBlob(found);
        holder.current.innerHTML = '';
        if (found.type.startsWith('image/')) {
          address = URL.createObjectURL(found);
          return setPicture(address);
        }
        const goTo = getState().documentPage;
        if (goTo) setState({ documentPage: null }); // used once: the next ODG or manual opens at its first page
        return drawPages(found, holder.current, () => cancelled, goTo);
      })
      .catch(error => !cancelled && setProblem(error.message));
    return () => { cancelled = true; if (address) URL.revokeObjectURL(address); };
  }, [documentPath]);

  const fileName = exportName(getState().project, getState().documentFile || `${documentTitle}.pdf`);
  return html`
    <div class="document-bar">
      <button class="link back" onClick=${() => showScreen(getState().documentFrom || 'schedule')}>‹ Back</button>
      <b>${documentTitle}</b>
      ${zoom > 1 && html`<button class="btn btn--small" onClick=${resetZoom}>↺ 100%</button>`}
      ${blob && html`<button class="btn btn--small" onClick=${() => shareFile(blob, fileName)}>Share</button>`}
    </div>
    ${problem && html`<p class="empty">${problem}</p>`}
    ${!problem && !blob && html`<p class="muted">Opening…</p>`}
    <div class="pdf-zoom" ref=${zoomBox}>
      ${picture && html`<div class="pdf-pages"><img class="pdf-page" src=${picture} alt=${documentTitle} /></div>`}
      <div class="pdf-pages" ref=${holder}></div>
    </div>`;
}
