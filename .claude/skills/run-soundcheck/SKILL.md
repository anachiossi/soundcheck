---
name: run-soundcheck
description: Launch the soundcheck app locally, screenshot every screen at phone/iPad/laptop sizes, test offline and exported images.
---
1. `cd D:\sound_check`, start `npm run serve` in the background (port 8321).
2. `node tests/screens.mjs D:\sound_check_data\projects\la-buona-educazione\la-buona-educazione.soundcheck.json`
3. Read the PNGs in `.shots/` (phone-*, ipad-*, laptop-*, export-*, laptop-offline). Never commit them.
