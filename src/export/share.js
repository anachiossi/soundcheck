// share.js — hands an exported image to the phone's Share sheet (WhatsApp,
// Photos, AirDrop, Files). On a laptop, or if sharing isn't possible, the
// PNG is downloaded instead.
// Used by: screens/schedule.js, screens/scenes.js

export async function shareCanvas(canvas, fileName) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // user closed the Share sheet
    }
  }
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
