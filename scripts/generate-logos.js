// Export PNG variants for logos using sharp
const fs = require('fs');
const path = require('path');

async function run(){
  const sharp = require('sharp');
  const imgDir = path.join(__dirname, '..', 'public', 'img');
  const variants = [
    { in: 'logo-horizontal.svg', out: 'logo-horizontal.png', w:840, h:168 },
    { in: 'logo-horizontal.svg', out: 'logo-horizontal-320.png', w:320, h:64 },
    { in: 'logo-horizontal-dark.svg', out: 'logo-horizontal-dark.png', w:840, h:168 },
    { in: 'logo-compact.svg', out: 'logo-compact.png', w:128, h:128 },
    { in: 'logo-compact-dark.svg', out: 'logo-compact-dark.png', w:128, h:128 }
  ];

  for (const v of variants){
    const input = path.join(imgDir, v.in);
    const output = path.join(imgDir, v.out);
    if (!fs.existsSync(input)) { console.error('Missing', input); continue; }
    console.log('Rendering', v.in, '->', v.out);
    try{
      await sharp(input).resize(v.w, v.h, { fit: 'contain' }).png({compressionLevel:9}).toFile(output);
      console.log('Wrote', output);
    }catch(err){ console.error('Failed', v.in, err); }
  }
}
run();
