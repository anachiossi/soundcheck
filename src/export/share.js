// share.js — hands exported images to the phone's Share sheet (WhatsApp,
// Photos, AirDrop, Files). Several images (e.g. "All film" in parts) go out
// together. On a laptop, or if sharing isn't possible, the PNGs are downloaded.
// Used by: screens/schedule.js, screens/scenes.js

export async function shareCanvas(canvas, fileName) {
  return shareCanvases([canvas], fileName);
}

// fileName like 'week-2.png'; parts become 'week-2-1.png', 'week-2-2.png', …
export async function shareCanvases(canvases, fileName) {
  const base = fileName.replace(/\.png$/, '');
  const files = await Promise.all(canvases.map(async (canvas, i) => {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const name = canvases.length > 1 ? `${base}-${i + 1}.png` : `${base}.png`;
    return new File([blob], name, { type: 'image/png' });
  }));

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // user closed the Share sheet
    }
  }
  for (const file of files) {
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}
