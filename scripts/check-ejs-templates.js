const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fp));
    } else if (file.endsWith('.ejs')) {
      results.push(fp);
    }
  });
  return results;
}

const viewsDir = path.join(__dirname, '..', 'views');
const files = walk(viewsDir);
let failed = false;
files.forEach(f => {
  try {
    const src = fs.readFileSync(f, 'utf8');
    ejs.compile(src, {filename: f});
    console.log('OK:', path.relative(process.cwd(), f));
  } catch (err) {
    failed = true;
    console.error('ERROR compiling', path.relative(process.cwd(), f));
    console.error(err && err.message ? err.message : err);
  }
});
process.exit(failed ? 1 : 0);
