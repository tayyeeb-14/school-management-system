Favicons and App Icon

Files added:
- public/img/favicon-shield.svg  — primary vector shield logo (transparent)
- public/img/favicon-32.svg      — optimized SVG for 32x32 use
- public/img/favicon-64.svg      — optimized SVG for 64x64 use
- public/img/app-icon.svg       — app icon style (128x128 SVG)
- scripts/generate-favicons.js  — Node script using `sharp` to export PNGs

Recommended export commands (ImageMagick):

Convert SVG to PNG with transparency:

```bash
convert -background none public/img/favicon-shield.svg -resize 32x32 public/img/favicon-32.png
convert -background none public/img/favicon-shield.svg -resize 64x64 public/img/favicon-64.png
convert -background none public/img/app-icon.svg -resize 180x180 public/img/app-icon-180.png
```

Or using Inkscape:

```bash
inkscape public/img/favicon-shield.svg --export-type=png --export-filename=public/img/favicon-32.png --export-width=32 --export-height=32
```

Or use the included Node script (requires `sharp`):

```bash
npm install sharp
node scripts/generate-favicons.js
```

Design notes:
- Palette: luxury navy `#0a2540` and gold `#D4AF37` for clear contrast at small sizes.
- Transparent background for browser tab rendering.
- Simple shield + book emblem optimized for crispness at small sizes.
- App icon uses a rounded square with subtle drop shadow for cinematic polish.

If you want, I can run the `generate-favicons.js` script here (will require installing `sharp`). I can also produce PNGs now if you prefer that I add them directly into the repo.
