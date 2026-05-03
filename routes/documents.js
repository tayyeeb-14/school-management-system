const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const Student = require('../models/Student');
const { generatePdfFromHtml } = require('../utils/pdf');
const { DOCUMENT_TYPE_MAP } = require('../utils/documentTypes');
const { calculateFinalResult, isMarksheetComplete } = require('../utils/marks');

const FALLBACK_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48"><rect width="100%" height="100%" fill="#2c7be5"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="16">School</text></svg>';
const FALLBACK_PHOTO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="110" height="140"><rect width="100%" height="100%" fill="#eeeeee"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#999999" font-family="Arial" font-size="13">No Photo</text></svg>';

// Helper to load student and enrich with user data
async function loadStudent(studentId) {
  if (!studentId) return null;
  const student = await Student.findById(studentId).populate('userId').populate('classId');
  return student;
}

function buildFileName(type, student) {
  const rawName = student?.userId?.username || student?.userId?.name || student?._id || 'student';
  const safeName = String(rawName).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${type}-${safeName || 'student'}.pdf`;
}

async function fileToDataUri(relativePublicPath, fallbackSvg) {
  const normalizedPath = String(relativePublicPath || '').replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(__dirname, '..', 'public', normalizedPath);

  if (fs.existsSync(absolutePath)) {
    const fileBuffer = await fs.promises.readFile(absolutePath);
    const ext = path.extname(absolutePath).slice(1).toLowerCase();
    const normalizedExt = ext === 'jpg' ? 'jpeg' : (ext || 'png');
    return `data:image/${normalizedExt};base64,${fileBuffer.toString('base64')}`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
}

function renderTemplate(app, viewName, data) {
  return new Promise((resolve, reject) => {
    app.render(viewName, data, (err, html) => {
      if (err) return reject(err);
      return resolve(html);
    });
  });
}

async function resolveStudentForRequest(req) {
  const role = req.session?.user?.role;

  if (role === 'admin') {
    if (!req.query.studentId) {
      return { status: 400, error: 'studentId is required for admin document access' };
    }

    const student = await loadStudent(req.query.studentId);
    if (!student) {
      return { status: 404, error: 'Student not found' };
    }

    return { student };
  }

  if (role === 'student') {
    const student = await Student.findOne({ userId: req.session.user.id }).populate('userId').populate('classId');

    if (!student) {
      return { status: 404, error: 'Student not found' };
    }

    if (student.status !== 'approved') {
      return { status: 403, error: 'Your account is pending approval. Documents are available after approval.' };
    }

    if (req.query.studentId && String(req.query.studentId) !== String(student._id)) {
      return { status: 403, error: 'Access denied. You can only access your own documents.' };
    }

    return { student };
  }

  return { status: 403, error: 'Access denied. Admin or student access is required.' };
}

async function buildDocumentRenderData(student, type) {
  const logoDataUri = await fileToDataUri('/img/logo.png', FALLBACK_LOGO_SVG);
  const photoPath = student?.userId?.photo ? `/uploads/images/${student.userId.photo}` : '/img/default-student.png';
  const photoDataUri = await fileToDataUri(photoPath, FALLBACK_PHOTO_SVG);

  const locals = {};
  if (type === 'certificate') {
    locals.certificateTitle = 'Certificate of Achievement';
  }
  if (type === 'marksheet') {
    locals.marksheetData = calculateFinalResult(student);
  }

  return {
    student,
    marks: Array.isArray(student?.marks) ? student.marks.map((entry) => entry?.marks || 0) : [],
    locals,
    logoDataUri,
    photoDataUri
  };
}

// Preview route (HTML)
router.get('/:type/preview', isLoggedIn, async (req, res) => {
  try {
    const { type } = req.params;
    if (!DOCUMENT_TYPE_MAP[type]) {
      return res.status(404).render('error', { error: 'Document type not found' });
    }

    const { student, error, status } = await resolveStudentForRequest(req);
    if (error) {
      return res.status(status).render('error', { error });
    }

    if (type === 'marksheet') {
      const completion = isMarksheetComplete(student);
      if (!completion.complete) {
        return res.status(400).render('error', {
          title: 'Document Error',
          error: `Marksheet is not ready. Missing entries: ${completion.missing.slice(0, 5).join(', ')}${completion.missing.length > 5 ? '...' : ''}`
        });
      }
    }

    const viewName = `documents/${type}`;
    const renderData = await buildDocumentRenderData(student, type);
    return res.render(viewName, { ...renderData, preview: true, layout: false });
  } catch (err) {
    console.error('Documents preview error:', err);
    return res.status(500).render('error', { error: 'Error rendering preview' });
  }
});

// Download route (PDF)
router.get('/:type/download', isLoggedIn, async (req, res) => {
  try {
    const { type } = req.params;
    if (!DOCUMENT_TYPE_MAP[type]) {
      return res.status(404).render('error', { error: 'Document type not found' });
    }

    const { student, error, status } = await resolveStudentForRequest(req);
    if (error) {
      return res.status(status).render('error', { error });
    }

    if (type === 'marksheet') {
      const completion = isMarksheetComplete(student);
      if (!completion.complete) {
        return res.status(400).render('error', {
          title: 'Document Error',
          error: `Marksheet is not ready. Missing entries: ${completion.missing.slice(0, 5).join(', ')}${completion.missing.length > 5 ? '...' : ''}`
        });
      }
    }

    const viewName = `documents/${type}`;
    const renderData = await buildDocumentRenderData(student, type);
    const html = await renderTemplate(req.app, viewName, { ...renderData, preview: false, layout: false });
    const pdfBuffer = await generatePdfFromHtml(html);
    const filename = buildFileName(type, student);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Documents download error:', err);
    return res.status(500).render('error', { error: 'Error generating document' });
  }
});

module.exports = router;
