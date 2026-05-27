// Script to generate PNG favicons from SVG source files.
// Requires `sharp` (npm i sharp) or use ImageMagick/inkscape commands shown in README.

const fs = require('fs');
const path = require('path');

async function run() {
  const sharp = require('sharp');
  const svgDir = path.join(__dirname, '..', 'public', 'img');
  const input = path.join(svgDir, 'favicon-shield.svg');
  if (!fs.existsSync(input)){
    console.error('SVG source not found:', input);
    process.exit(1);
  }

  const out32 = path.join(svgDir, 'favicon-32.png');
  const out64 = path.join(svgDir, 'favicon-64.png');
  const out180 = path.join(svgDir, 'app-icon-180.png');

  try {
    console.log('Generating 32x32...');
    await sharp(input).resize(32,32).png({compressionLevel:9}).toFile(out32);
    console.log('Generated', out32);

    console.log('Generating 64x64...');
    await sharp(input).resize(64,64).png({compressionLevel:9}).toFile(out64);
    console.log('Generated', out64);

    console.log('Generating 180x180 app icon...');
    await sharp(input).resize(180,180).png({compressionLevel:9}).toFile(out180);
    console.log('Generated', out180);

    console.log('Done.');
  } catch (err) {
    console.error('Error generating PNGs', err);
    console.error('If sharp is unavailable, use ImageMagick or Inkscape to export SVG to PNG.');
    process.exit(2);
  }
}

run();