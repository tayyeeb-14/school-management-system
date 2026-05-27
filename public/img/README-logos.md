MySchool Portal — Logo Assets

Files added in `public/img/`:
- logo-horizontal.svg        — premium horizontal logo (transparent)
- logo-horizontal-dark.svg   — horizontal logo optimized for dark backgrounds
- logo-compact.svg           — compact icon (transparent)
- logo-compact-dark.svg      — compact icon with dark rounded bg

Scripts:
- scripts/generate-logos.js  — node script using `sharp` to export PNG variants

How to export PNGs:

Install `sharp`:

```bash
npm install sharp
```

Run export:

```bash
node scripts/generate-logos.js
```

Design notes:
- Palette: deep navy `#071739` and gold `#D4A537` with subtle gradients and highlights.
- Typography: suggested families used are `Georgia`/serif for `MySchool` and `Arial`/sans for `Portal`.
- SVGs are vector and scalable; use `logo-horizontal-dark.svg` against dark headers.
- Compact icon optimized for small sizes and favicon usage.

If you'd like, I can:
- Produce PNGs now and commit them (will install `sharp`).
- Create additional sizes (favicon `ico`, Apple touch icons, manifest.json).
- Convert the text to outline paths for absolute font rendering (recommended for exact brand lock).
