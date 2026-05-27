const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function process() {
  const srcDesktop = path.join(__dirname, '..', 'public', 'img', 'hero-desktop-1920x1080.jpg');
  const srcMobile = path.join(__dirname, '..', 'public', 'img', 'hero-mobile-1080x1920.jpg');
  const outDir = path.join(__dirname, '..', 'public', 'img');
  if (!fs.existsSync(srcDesktop) || !fs.existsSync(srcMobile)) {
    console.error('Source hero images not found. Expected:', srcDesktop, srcMobile);
    process.exit(1);
  }

  // Desktop graded
  const desktopOut = path.join(outDir, 'hero-desktop-graded.jpg');
  const desktopWebp = path.join(outDir, 'hero-desktop-graded.webp');
  const desktopLqip = path.join(outDir, 'hero-desktop-lqip.jpg');

  // Mobile graded
  const mobileOut = path.join(outDir, 'hero-mobile-graded.jpg');
  const mobileWebp = path.join(outDir, 'hero-mobile-graded.webp');
  const mobileLqip = path.join(outDir, 'hero-mobile-lqip.jpg');

  // Common grading pipeline: crop (left focus), resize, color grade (tint/contrast), vignette via overlay
  // Desktop: crop center-left
  await sharp(srcDesktop)
    .resize(1920, 1080, { fit: 'cover', position: sharp.strategy.attention })
    .modulate({ brightness: 0.96, saturation: 0.92 })
    .linear(1.02, -6)
    .toFile(desktopOut);

  await sharp(desktopOut)
    .webp({ quality: 82 })
    .toFile(desktopWebp);

  await sharp(desktopOut)
    .resize(40)
    .blur(6)
    .toFile(desktopLqip);

  // Mobile: crop for vertical composition
  await sharp(srcMobile)
    .resize(1080, 1920, { fit: 'cover', position: sharp.strategy.entropy })
    .modulate({ brightness: 0.98, saturation: 0.9 })
    .linear(1.02, -4)
    .toFile(mobileOut);

  await sharp(mobileOut)
    .webp({ quality: 82 })
    .toFile(mobileWebp);

  await sharp(mobileOut)
    .resize(30)
    .blur(6)
    .toFile(mobileLqip);

  console.log('Wrote graded images and webp + lqip:');
  console.log(desktopOut, desktopWebp, desktopLqip);
  console.log(mobileOut, mobileWebp, mobileLqip);

  // Also output base64 LQIP snippets to /tmp or console
  const deskLqipBuf = fs.readFileSync(desktopLqip);
  const mobLqipBuf = fs.readFileSync(mobileLqip);
  console.log('Desktop LQIP base64:', 'data:image/jpeg;base64,' + deskLqipBuf.toString('base64').slice(0, 200) + '...');
  console.log('Mobile LQIP base64:', 'data:image/jpeg;base64,' + mobLqipBuf.toString('base64').slice(0, 200) + '...');
}

process().catch(err => { console.error(err); process.exit(1); });
