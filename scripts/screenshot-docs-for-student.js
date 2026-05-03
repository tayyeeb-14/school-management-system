require('dotenv').config();
const path = require('path');
const fs = require('fs');
const util = require('util');
const ejs = require('ejs');
const connectDB = require('../config/database');
const Student = require('../models/Student');
require('../models/User');
require('../models/Class');
const { default: puppeteer } = require('puppeteer');

const readFile = util.promisify(fs.readFile);
const renderFile = util.promisify(ejs.renderFile);

async function fileToDataUri(relPath, fallbackSvg) {
  const p = path.resolve(__dirname, '..', 'public', relPath.replace(/^\//, ''));
  if (fs.existsSync(p)) {
    const buf = await readFile(p);
    const ext = path.extname(p).slice(1) || 'png';
    return `data:image/${ext};base64,${buf.toString('base64')}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
}

async function inlineLocalImages(html) {
  const workspace = path.resolve(__dirname, '..');
  const replacements = [];
  const imgRegex = /src=["'](\/uploads\/images\/[^"']+|\/img\/[^"']+)["']/g;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[1];
    const localPath = path.join(workspace, 'public', src.replace(/^\//, ''));
    if (fs.existsSync(localPath)) {
      try {
        const buf = await readFile(localPath);
        const ext = path.extname(localPath).slice(1) || 'png';
        const dataUri = `data:image/${ext};base64,${buf.toString('base64')}`;
        replacements.push({ from: src, to: dataUri });
      } catch (err) {
        // ignore
      }
    }
  }

  let out = html;
  for (const r of replacements) out = out.split(r.from).join(r.to);
  return out;
}

async function pickStudent() {
  let student = await Student.findOne({ rollNo: { $exists: true, $ne: null }, 'marks.0': { $exists: true } })
    .populate('userId classId')
    .exec();
  if (!student) student = await Student.findOne({}).populate('userId classId').exec();
  return student;
}

async function main() {
  await connectDB();
  const student = await pickStudent();
  if (!student) {
    console.error('No student found');
    process.exit(1);
  }

  const templates = [
    { name: 'marksheet', file: path.resolve(__dirname, '..', 'views', 'documents', 'marksheet.ejs') },
    { name: 'admit-card', file: path.resolve(__dirname, '..', 'views', 'documents', 'admit-card.ejs') },
    { name: 'id-card-front', file: path.resolve(__dirname, '..', 'views', 'documents', 'id-card-front.ejs') },
    { name: 'certificate', file: path.resolve(__dirname, '..', 'views', 'documents', 'certificate.ejs') }
  ];

  const outDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();

    for (const t of templates) {
      if (!fs.existsSync(t.file)) {
        console.warn('Missing template:', t.file);
        continue;
      }

      const fallbackLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#2c7be5"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Arial" font-size="16">School</text></svg>';
      const fallbackPhoto = '<svg xmlns="http://www.w3.org/2000/svg" width="110" height="140"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-family="Arial" font-size="14">No Photo</text></svg>';
      const logoDataUri = await fileToDataUri('/img/logo.png', fallbackLogo);
      const photoRel = (student.userId && student.userId.photo) ? `/uploads/images/${student.userId.photo}` : '/img/default-student.png';
      const photoDataUri = await fileToDataUri(photoRel, fallbackPhoto);
      const data = { student, marks: (student.marks || []).map(m => m.marks || 0), locals: {}, logoDataUri, photoDataUri };
      if (t.name === 'certificate') data.locals.certificateTitle = 'Certificate of Achievement';

      let html;
      try { html = await renderFile(t.file, data, { async: true }); }
      catch (err) { console.error('Render error', t.name, err); continue; }

      const htmlInlined = await inlineLocalImages(html);
      // Try to set content with networkidle0, fallback to load
      try {
        await page.setContent(htmlInlined, { waitUntil: 'networkidle0', timeout: 60000 });
      } catch (err) {
        console.warn('setContent timeout, continuing with partial load for', t.name);
        try { await page.setContent(htmlInlined, { waitUntil: 'load', timeout: 30000 }); } catch(e) { console.warn('second setContent also failed', e.message); }
      }

      // Force white background and center the container in case rendering environment differs
      try {
        await page.evaluate(() => {
          document.documentElement.style.background = '#fff';
          document.body.style.background = '#fff';
          const wrapper = document.querySelector('.doc-body-wrapper');
          if (wrapper) wrapper.style.justifyContent = 'center';
          const container = document.querySelector('.doc-container');
          if (container) container.style.margin = '0 auto';
        });
      } catch (e) {
        // ignore
      }

      // Ensure viewport large enough to render document; increase deviceScaleFactor for clarity
      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

      const pngPath = path.join(outDir, `${t.name}-${student._id}.png`);
      try {
        // Prefer element screenshot of the .doc-container so image is tightly cropped and scaled
        const el = await page.$('.doc-container');
        if (el) {
          await el.screenshot({ path: pngPath, omitBackground: false });
          console.log('Saved element screenshot:', pngPath);
        } else {
          // fallback to full page
          await page.screenshot({ path: pngPath, fullPage: true });
          console.log('Saved full-page screenshot (fallback):', pngPath);
        }
      } catch (err) {
        console.error('Screenshot failed for', t.name, err.message);
      }
    }

  } finally {
    await browser.close();
  }

  console.log('Screenshots saved to scripts/output');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
