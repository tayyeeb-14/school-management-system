require('dotenv').config();
const path = require('path');
const fs = require('fs');
const util = require('util');
const ejs = require('ejs');
const connectDB = require('../config/database');
const Student = require('../models/Student');
const User = require('../models/User');
const ClassModel = require('../models/Class');
const { generatePdfFromHtml } = require('../utils/pdf');

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
  // Replace references to /uploads/images/... and /img/... with data URIs when possible
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
  for (const r of replacements) {
    out = out.split(r.from).join(r.to);
  }
  return out;
}

async function pickStudent() {
  // Prefer a student with rollNo and marks
  let student = await Student.findOne({ rollNo: { $exists: true, $ne: null }, 'marks.0': { $exists: true } })
    .populate('userId classId')
    .exec();

  if (!student) {
    // fallback to any student with user populated
    student = await Student.findOne({})
      .populate('userId classId')
      .exec();
  }
  return student;
}

async function generateFor(student) {
  const outDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const templates = [
    { name: 'marksheet', file: path.resolve(__dirname, '..', 'views', 'documents', 'marksheet.ejs') },
    { name: 'admit-card', file: path.resolve(__dirname, '..', 'views', 'documents', 'admit-card.ejs') },
    { name: 'id-card-front', file: path.resolve(__dirname, '..', 'views', 'documents', 'id-card-front.ejs') },
    { name: 'certificate', file: path.resolve(__dirname, '..', 'views', 'documents', 'certificate.ejs') }
  ];

  for (const t of templates) {
    if (!fs.existsSync(t.file)) {
      console.warn('Template missing:', t.file);
      continue;
    }

    // Prepare data for template
    const fallbackLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#2c7be5"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Arial" font-size="16">School</text></svg>';
    const fallbackPhoto = '<svg xmlns="http://www.w3.org/2000/svg" width="110" height="140"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-family="Arial" font-size="14">No Photo</text></svg>';
    const logoDataUri = await fileToDataUri('/img/logo.png', fallbackLogo);
    const photoRel = (student.userId && student.userId.photo) ? `/uploads/images/${student.userId.photo}` : '/img/default-student.png';
    const photoDataUri = await fileToDataUri(photoRel, fallbackPhoto);

    const data = {
      student,
      // marks array convenient for simple templates
      marks: (student.marks && student.marks.length) ? student.marks.map(m => (m.marks || 0)) : [],
      locals: {},
      logoDataUri,
      photoDataUri
    };

    // allow certificate dynamic title
    if (t.name === 'certificate') data.locals.certificateTitle = 'Certificate of Achievement';

    let html;
    try {
      html = await renderFile(t.file, data, { async: true });
    } catch (err) {
      console.error('EJS render error for', t.name, err);
      continue;
    }

    // Inline local images so Puppeteer can render without a running server
    const htmlInlined = await inlineLocalImages(html);

    try {
      const pdfBuffer = await generatePdfFromHtml(htmlInlined, { format: 'A4' });
      const outPath = path.join(outDir, `${t.name}-${student._id}.pdf`);
      fs.writeFileSync(outPath, pdfBuffer);
      console.log('Generated:', outPath);
    } catch (err) {
      console.error('PDF generation error for', t.name, err);
    }
  }
}

async function main() {
  await connectDB();
  const student = await pickStudent();
  if (!student) {
    console.error('No student found in database.');
    process.exit(1);
  }

  console.log('Selected student:', (student.userId && student.userId.name) || student._id);
  // Ensure populated userId and classId
  if (!student.userId || !student.classId) {
    console.warn('Warning: student missing populated userId or classId. Attempting to populate now.');
    await student.populate('userId classId');
  }

  // Normalize some fields
  if (!student.subjects || !student.subjects.length) {
    student.subjects = student.marks && student.marks.length ? student.marks.map(m => m.subject || 'Subject') : ['Mathematics','English','Science'];
  }

  await generateFor(student);
  console.log('Done. PDFs are in scripts/output');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
