const EXAM_CONFIG = Object.freeze([
  { key: 'UT1', label: 'UT1', weight: 0.15 },
  { key: 'UT2', label: 'UT2', weight: 0.15 },
  { key: 'HALF_YEARLY', label: 'Half Yearly', weight: 0.30 },
  { key: 'FINAL', label: 'Final', weight: 0.40 }
]);

const EXAM_KEYS = Object.freeze(EXAM_CONFIG.map((exam) => exam.key));

const EXAM_BY_KEY = Object.freeze(
  EXAM_CONFIG.reduce((acc, exam) => {
    acc[exam.key] = exam;
    return acc;
  }, {})
);

function roundTo(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function gradeFromPercentage(percent) {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
}

function getStudentSubjects(student) {
  const subjectSet = new Set(
    (Array.isArray(student?.subjects) ? student.subjects : [])
      .map((subject) => String(subject || '').trim())
      .filter(Boolean)
  );

  return Array.from(subjectSet);
}

function normaliseMarksEntry(entry) {
  const examType = String(entry?.examType || '').trim().toUpperCase().replace(/\s+/g, '_');
  return {
    subject: String(entry?.subject || '').trim(),
    examType,
    marks: Number(entry?.marks) || 0,
    outOf: Number(entry?.outOf) || 0,
    date: entry?.date ? new Date(entry.date) : null
  };
}

function getMarkEntry(student, subject, examType) {
  const marks = Array.isArray(student?.marks) ? student.marks : [];
  return marks
    .map(normaliseMarksEntry)
    .find((entry) => entry.subject === subject && entry.examType === examType);
}

function isMarksheetComplete(student) {
  const subjects = getStudentSubjects(student);
  if (!subjects.length) {
    return {
      complete: false,
      missing: ['No subjects assigned to this student.'],
      subjects
    };
  }

  const missing = [];
  for (const subject of subjects) {
    for (const examType of EXAM_KEYS) {
      const entry = getMarkEntry(student, subject, examType);
      if (!entry || !entry.outOf || entry.marks < 0) {
        missing.push(`${subject} - ${EXAM_BY_KEY[examType].label}`);
      }
    }
  }

  return {
    complete: missing.length === 0,
    missing,
    subjects
  };
}

function calculateFinalResult(student) {
  const subjects = getStudentSubjects(student);
  const rows = [];
  let subjectTotal = 0;

  for (const subject of subjects) {
    let weightedPercentage = 0;
    const exams = {};

    for (const exam of EXAM_CONFIG) {
      const entry = getMarkEntry(student, subject, exam.key);
      const percentage = entry && entry.outOf > 0 ? (entry.marks / entry.outOf) * 100 : 0;
      weightedPercentage += percentage * exam.weight;
      exams[exam.key] = {
        label: exam.label,
        marks: entry ? entry.marks : null,
        outOf: entry ? entry.outOf : null,
        percentage: roundTo(percentage, 2),
        weight: exam.weight
      };
    }

    const finalPercentage = roundTo(weightedPercentage, 2);
    subjectTotal += finalPercentage;

    rows.push({
      subject,
      exams,
      finalPercentage,
      grade: gradeFromPercentage(finalPercentage)
    });
  }

  const overallPercentage = rows.length ? roundTo(subjectTotal / rows.length, 2) : 0;

  return {
    rows,
    overallPercentage,
    overallGrade: gradeFromPercentage(overallPercentage),
    examConfig: EXAM_CONFIG
  };
}

module.exports = {
  EXAM_CONFIG,
  EXAM_KEYS,
  EXAM_BY_KEY,
  gradeFromPercentage,
  getStudentSubjects,
  isMarksheetComplete,
  calculateFinalResult
};
