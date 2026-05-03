const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const Student = require('../models/Student');
const User = require('../models/User');
const { generatePdfFromHtml } = require('../utils/pdf');

// Helper to load student and enrich with user data
async function loadStudent(studentId) {
  if (!studentId) return null;
  const student = await Student.findById(studentId).populate('userId').populate('classId');
  return student;
}

// Preview route (HTML)
router.get('/:type/preview', isLoggedIn, async (req, res) => {
  try {
    const { type } = req.params;
    const studentId = req.query.studentId;
    const student = await loadStudent(studentId);

    if (!student) {
      return res.status(404).render('error', { error: 'Student not found or studentId missing' });
    }

    // Render the appropriate template
    const viewName = `documents/${type}`;
    return res.render(viewName, { student, preview: true });
  } catch (err) {
    console.error('Documents preview error:', err);
    return res.status(500).render('error', { error: 'Error rendering preview' });
  }
});

// Download route (PDF)
router.get('/:type/download', isLoggedIn, async (req, res) => {
  try {
    const { type } = req.params;
    const studentId = req.query.studentId;
    const student = await loadStudent(studentId);

    if (!student) {
      return res.status(404).render('error', { error: 'Student not found or studentId missing' });
    }

    const viewName = `documents/${type}`;

    // Render HTML string
    req.app.render(viewName, { student, preview: false }, async (err, html) => {
      if (err) {
        console.error('Render error for PDF:', err);
        return res.status(500).render('error', { error: 'Error generating document' });
      }

      try {
        const pdfBuffer = await generatePdfFromHtml(html);
        const filename = `${type}-${student.userId.username || student._id}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
        return res.status(500).render('error', { error: 'Error generating PDF' });
      }
    });
  } catch (err) {
    console.error('Documents download error:', err);
    return res.status(500).render('error', { error: 'Error generating document' });
  }
});

module.exports = router;
