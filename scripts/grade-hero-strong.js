const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function run() {
  const srcDesktop = path.join(__dirname, '..', 'public', 'img', 'hero-desktop-1920x1080.jpg');
  const srcMobile = path.join(__dirname, '..', 'public', 'img', 'hero-mobile-1080x1920.jpg');
  const outDir = path.join(__dirname, '..', 'public', 'img');
  if (!fs.existsSync(srcDesktop) || !fs.existsSync(srcMobile)) {
    console.error('Source hero images not found. Expected:', srcDesktop, srcMobile);
    process.exit(1);
  }

  // Strong desktop variant: crop left-centered, desaturate, increase contrast, add blur to background, stronger vignette
  const desktopSrc = srcDesktop;
  const desktopOut = path.join(outDir, 'hero-desktop-strong.jpg');
  const desktopWebp = path.join(outDir, 'hero-desktop-strong.webp');
  const desktopLqip = path.join(outDir, 'hero-desktop-strong-lqip.jpg');

  // Create a blurred, desaturated base
  const blurred = await sharp(desktopSrc)
    .resize(1920, 1080, { fit: 'cover', position: sharp.strategy.attention })
    .modulate({ brightness: 0.95, saturation: 0.75 })
    .blur(6)
    .toBuffer();

  // Create a focused layer slightly sharpened and cropped left
  const focused = await sharp(desktopSrc)
    .resize(1920, 1080, { fit: 'cover', position: 'left' })
    .modulate({ brightness: 1.02, saturation: 0.9 })
    .sharpen()
    .toBuffer();

  // Composite: put focused over blurred with low opacity to reduce detail overall, then apply vignette overlay
  await sharp(blurred)
    .composite([
      { input: focused, blend: 'overlay', gravity: 'west', opacity: 0.42 },
      { input: Buffer.from(
        `<svg width="1920" height="1080">
          <defs>
            <radialGradient id="g" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stop-color="rgba(0,0,0,0)" />
              <stop offset="60%" stop-color="rgba(0,0,0,0.12)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0.36)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>`),
        blend: 'over'
      }
    ])
    .modulate({ brightness: 0.96 })
    .toFile(desktopOut);

  await sharp(desktopOut).webp({ quality: 84 }).toFile(desktopWebp);
  await sharp(desktopOut).resize(40).blur(6).toFile(desktopLqip);

  // Mobile strong variant: focus on center crop, desaturate, mild blur
  const mobileOut = path.join(outDir, 'hero-mobile-strong.jpg');
  const mobileWebp = path.join(outDir, 'hero-mobile-strong.webp');
  const mobileLqip = path.join(outDir, 'hero-mobile-strong-lqip.jpg');

  const mobileBlurred = await sharp(srcMobile)
    .resize(1080, 1920, { fit: 'cover', position: sharp.strategy.entropy })
    .modulate({ brightness: 0.97, saturation: 0.78 })
    .blur(5)
    .toBuffer();

  const mobileFocused = await sharp(srcMobile)
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .sharpen()
    .toBuffer();

  await sharp(mobileBlurred)
    .composite([
      { input: mobileFocused, blend: 'overlay', opacity: 0.45 }
    ])
    .composite([{ input: Buffer.from(
      `<svg width="1080" height="1920">
        <defs>
          <radialGradient id="g2" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stop-color="rgba(0,0,0,0)" />
            <stop offset="60%" stop-color="rgba(0,0,0,0.12)" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.38)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g2)" />
      </svg>`), blend: 'over' }])
    .modulate({ brightness: 0.98 })
    .toFile(mobileOut);

  await sharp(mobileOut).webp({ quality: 84 }).toFile(mobileWebp);
  await sharp(mobileOut).resize(30).blur(4).toFile(mobileLqip);

  console.log('Wrote strong hero variants:', desktopOut, desktopWebp, desktopLqip);
  console.log('Wrote strong hero variants:', mobileOut, mobileWebp, mobileLqip);
}

run().catch(err => { console.error(err); process.exit(1); });
