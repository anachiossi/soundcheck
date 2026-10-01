// document.js — reads a day's PDF (ODG or sides) from the copy kept on the device,
// so it opens with no signal. Pages are drawn one under the other, as wide as the
// screen; pinch to zoom. "Share" hands the PDF to the phone (Files, Books, WhatsApp…).
// The PDF drawing uses pdf.js (vendor/pdfjs), loaded only when a document is opened.
// Used by: main.js (opened from the 📄 buttons in the Schedule)

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { showScreen, getState } from '../state.js';
import { exportName } from '../model.js';
import { loadDocument } from '../store/local.js';
import { shareFile } from '../export/share.js';

async function drawPages(blob, holder, isCancelled) {
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
  }
}

export function DocumentScreen({ state }) {
  const { project, documentPath, documentTitle } = state;
  const holder = useRef(null);
  const [problem, setProblem] = useState('');
  const [blob, setBlob] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProblem('');
    loadDocument(project.id, documentPath)
      .then(found => {
        if (!found) throw new Error('This document is not on this device yet. Open the app once with signal.');
        setBlob(found);
        return drawPages(found, holder.current, () => cancelled);
      })
      .catch(error => !cancelled && setProblem(error.message));
    return () => { cancelled = true; };
  }, [documentPath]);

  const fileName = exportName(getState().project, getState().documentFile || `${documentTitle}.pdf`);
  return html`
    <div class="document-bar">
      <button class="link back" onClick=${() => showScreen('schedule')}>‹ Back</button>
      <b>${documentTitle}</b>
      ${blob && html`<button class="btn btn--small" onClick=${() => shareFile(blob, fileName)}>Share</button>`}
    </div>
    ${problem && html`<p class="empty">${problem}</p>`}
    ${!problem && !blob && html`<p class="muted">Opening…</p>`}
    <div class="pdf-pages" ref=${holder}></div>`;
}
