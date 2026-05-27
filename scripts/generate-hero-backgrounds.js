// Generates cinematic hero background images (desktop & mobile) from a source photo.
// Produces overlay-friendly images with subtle gradients for text placement.
// Requires `sharp` (npm i sharp)

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const src = path.join(__dirname, '..', 'public', 'img', '1.jpg'); // default source
const outDir = path.join(__dirname, '..', 'public', 'img');

async function makeDesktop(){
  const out = path.join(outDir, 'hero-desktop-1920x1080.jpg');
  // left-side dark gradient overlay svg
  const svg = `
  <svg width="1920" height="1080">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.55" />
        <stop offset="35%" stop-color="#000000" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1920" height="1080" fill="url(#g)" />
  </svg>`;

  await sharp(src)
    .resize(1920,1080, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 92 })
    .toFile(out);
  console.log('Wrote', out);
}

async function makeMobile(){
  const out = path.join(outDir, 'hero-mobile-1080x1920.jpg');
  // top dark gradient svg for mobile
  const svg = `
  <svg width="1080" height="1920">
    <defs>
      <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.65" />
        <stop offset="28%" stop-color="#000000" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1080" height="1920" fill="url(#g)" />
  </svg>`;

  await sharp(src)
    .resize(1080,1920, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 92 })
    .toFile(out);
  console.log('Wrote', out);
}

async function run(){
  if (!fs.existsSync(src)) { console.error('Source image not found:', src); process.exit(1); }
  try{
    await makeDesktop();
    await makeMobile();
    console.log('Hero backgrounds generated successfully.');
  }catch(err){
    console.error('Error generating hero backgrounds:', err);
    process.exit(2);
  }
}

run();
