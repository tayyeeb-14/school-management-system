const express = require('express');
const router = express.Router();
const { isLoggedIn, isTeacher } = require('../middleware/auth');
const Teacher = require('../models/Teacher');
const TeacherShift = require('../models/TeacherShift');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const Blog = require('../models/Blog');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const upload = require('../config/multer');
const { EXAM_BY_KEY, EXAM_CONFIG, isMarksheetComplete, calculateFinalResult } = require('../utils/marks');

function toStartOfDay(dateInput = new Date()) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function toMonthKey(dateInput = new Date()) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function getTeacherContext(userId) {
    return Teacher.findOne({ userId }).populate('userId').populate('classIds', 'name');
}

function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
}

// Protect all teacher routes
router.use(isLoggedIn, isTeacher);

// Use dashboard layout for teacher routes and set path
router.use((req, res, next) => {
    res.locals.layout = 'layouts/dashboard';
    res.locals.path = req.path;
    next();
});

// Teacher Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/');
        }

        const classIds = teacher.classIds.map((item) => item._id);
        const assignedStudents = await Student.find({
            classId: { $in: classIds },
            status: 'approved'
        }).select('marks subjects');

        const marksPendingStudents = assignedStudents.filter((student) => !isMarksheetComplete(student).complete).length;
        const startOfToday = toStartOfDay(new Date());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

        const stats = {
            classes: classIds.length,
            students: assignedStudents.length,
            attendanceMarkedToday: await Attendance.countDocuments({
                markedBy: teacher._id,
                date: { $gte: startOfToday, $lte: endOfToday }
            }),
            marksPendingStudents
        };

        const recentAttendance = await Attendance.find({ markedBy: teacher._id })
            .populate('classId', 'name')
            .sort({ date: -1 })
            .limit(5);

        const recentShifts = await TeacherShift.find({ teacherId: teacher._id })
            .sort({ date: -1 })
            .limit(5);

        const currentMonth = toMonthKey();
        let currentSalary = await Salary.findOne({ teacherId: teacher._id, month: currentMonth });
        if (!currentSalary) {
            currentSalary = await Salary.create({
                teacherId: teacher._id,
                month: currentMonth,
                baseSalary: Number(teacher.monthlySalary || 0)
            });
        }

        res.render('teacher/dashboard', {
            title: 'Teacher Dashboard',
            teacher,
            stats,
            recentAttendance,
            recentShifts,
            currentSalary,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Teacher check-in
router.post('/check-in', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const now = new Date();
        const dateKey = new Date(now);
        dateKey.setHours(0, 0, 0, 0);

        const location = req.body.location || req.body.lat && req.body.lng ? `lat:${req.body.lat},lng:${req.body.lng}` : 'unknown';

        const update = {
            $setOnInsert: {
                teacherId: teacher._id,
                date: dateKey,
                checkInAt: now,
                checkInLocation: location
            }
        };

        await TeacherShift.findOneAndUpdate({ teacherId: teacher._id, date: dateKey }, update, { upsert: true, new: true });

        req.flash('success_msg', 'Checked in successfully');
        res.redirect('/teacher/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error during check-in');
        res.redirect('/teacher/dashboard');
    }
});

// Teacher check-out
router.post('/check-out', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const now = new Date();
        const dateKey = new Date(now);
        dateKey.setHours(0, 0, 0, 0);

        const location = req.body.location || req.body.lat && req.body.lng ? `lat:${req.body.lat},lng:${req.body.lng}` : 'unknown';

        const shift = await TeacherShift.findOne({ teacherId: teacher._id, date: dateKey });
        if (!shift) {
            req.flash('error_msg', 'No check-in found for today');
            return res.redirect('/teacher/dashboard');
        }

        if (shift.checkOutAt) {
            req.flash('error_msg', 'Already checked out for today');
            return res.redirect('/teacher/dashboard');
        }

        const durationMs = now.getTime() - (shift.checkInAt ? new Date(shift.checkInAt).getTime() : now.getTime());
        const durationMinutes = Math.round(durationMs / 60000);

        shift.checkOutAt = now;
        shift.checkOutLocation = location;
        shift.durationMinutes = durationMinutes;
        await shift.save();

        req.flash('success_msg', 'Checked out successfully');
        res.redirect('/teacher/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error during check-out');
        res.redirect('/teacher/dashboard');
    }
});

// Teacher Students Overview
router.get('/students', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const students = await Student.find({
            classId: { $in: teacher.classIds.map((item) => item._id) },
            status: 'approved'
        })
            .populate('userId', 'name')
            .populate('classId', 'name')
            .sort({ 'classId.name': 1, rollNo: 1 });

        const studentRows = students.map((student) => {
            const completion = isMarksheetComplete(student);
            const finalResult = calculateFinalResult(student);
            return {
                student,
                completion,
                finalResult
            };
        });

        res.render('teacher/students', {
            title: 'My Students',
            teacher,
            studentRows
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Mark Attendance Form
router.get('/attendance', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const classes = teacher.classIds || [];
        const selectedClassId = req.query.classId || (classes[0]?._id ? String(classes[0]._id) : '');
        const selectedDate = toStartOfDay(req.query.date || new Date());

        if (!selectedClassId) {
            return res.render('teacher/attendance', {
                title: 'Mark Attendance',
                teacher,
                classes,
                selectedClassId: '',
                selectedDate: selectedDate ? selectedDate.toISOString().slice(0, 10) : '',
                students: [],
                statusMap: {}
            });
        }

        // Enforce class-teacher rule: if the Class has a class teacher assigned, only that teacher may mark attendance.
        const classDoc = await Class.findById(selectedClassId).select('teacherId');
        if (classDoc && classDoc.teacherId) {
            if (String(classDoc.teacherId) !== String(teacher._id)) {
                req.flash('error_msg', 'Only the assigned class teacher can access this class attendance');
                return res.redirect('/teacher/attendance');
            }
        } else {
            const classAllowed = classes.some((item) => String(item._id) === String(selectedClassId));
            if (!classAllowed) {
                req.flash('error_msg', 'Access denied for selected class');
                return res.redirect('/teacher/attendance');
            }
        }

        const students = await Student.find({
            classId: selectedClassId,
            status: 'approved'
        })
            .populate('userId', 'name')
            .sort({ rollNo: 1 });

        const existingRecord = await Attendance.findOne({
            classId: selectedClassId,
            date: {
                $gte: selectedDate,
                $lte: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1)
            }
        });

        const statusMap = {};
        if (existingRecord) {
            for (const entry of existingRecord.entries) {
                statusMap[String(entry.studentId)] = entry.status;
            }
        }

        res.render('teacher/attendance', {
            title: 'Mark Attendance',
            teacher,
            classes,
            selectedClassId,
            selectedDate: selectedDate ? selectedDate.toISOString().slice(0, 10) : '',
            students,
            statusMap
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Submit Attendance
router.post('/attendance', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const selectedClassId = req.body.classId;
        const selectedDate = toStartOfDay(req.body.date || new Date());
        const submitted = req.body.attendance || {};

        // Enforce class-teacher rule for submission: if class has a class teacher assigned, only that teacher may submit.
        const classDoc = await Class.findById(selectedClassId).select('teacherId');
        if (classDoc && classDoc.teacherId) {
            if (String(classDoc.teacherId) !== String(teacher._id)) {
                req.flash('error_msg', 'Only the assigned class teacher can submit attendance for this class');
                return res.redirect('/teacher/attendance');
            }
        } else {
            const classAllowed = teacher.classIds.some((item) => String(item._id) === String(selectedClassId));
            if (!classAllowed) {
                req.flash('error_msg', 'Access denied for selected class');
                return res.redirect('/teacher/attendance');
            }
        }

        const students = await Student.find({
            classId: selectedClassId,
            status: 'approved'
        }).select('_id attendance');

        const entries = students.map((student) => ({
            studentId: student._id,
            status: submitted[String(student._id)] === 'present' ? 'present' : 'absent'
        }));

        await Attendance.findOneAndUpdate(
            { classId: selectedClassId, date: selectedDate },
            {
                classId: selectedClassId,
                date: selectedDate,
                markedBy: teacher._id,
                entries
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Keep legacy student attendance array in sync for existing features
        for (const entry of entries) {
            await Student.findByIdAndUpdate(entry.studentId, {
                $pull: {
                    attendance: {
                        date: {
                            $gte: selectedDate,
                            $lte: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1)
                        }
                    }
                }
            });

            await Student.findByIdAndUpdate(entry.studentId, {
                $push: {
                    attendance: {
                        date: selectedDate,
                        status: entry.status
                    }
                }
            });
        }

        req.flash('success_msg', 'Attendance marked successfully');
        res.redirect(`/teacher/attendance?classId=${selectedClassId}&date=${selectedDate.toISOString().slice(0, 10)}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error marking attendance');
        res.redirect('/teacher/attendance');
    }
});

// Marks Entry Form
router.get('/marks', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const classes = teacher.classIds || [];
        const selectedClassId = req.query.classId || (classes[0]?._id ? String(classes[0]._id) : '');
        const selectedExamType = String(req.query.examType || EXAM_CONFIG[0].key).toUpperCase();
        const selectedSubject = String(req.query.subject || (teacher.subjects && teacher.subjects[0]) || '').trim();

        if (!selectedClassId) {
            return res.render('teacher/marks', {
                title: 'Enter Marks',
                teacher,
                classes,
                selectedClassId: '',
                selectedExamType,
                selectedSubject: String(req.query.subject || (teacher.subjects && teacher.subjects[0]) || '').trim(),
                examConfig: EXAM_CONFIG,
                students: [],
                subjectOptions: [],
                marksMap: {}
            });
        }

        const classAllowed = classes.some((item) => String(item._id) === String(selectedClassId));
        if (!classAllowed) {
            req.flash('error_msg', 'Access denied for selected class');
            return res.redirect('/teacher/marks');
        }

        const students = await Student.find({
            classId: selectedClassId,
            status: 'approved'
        })
            .populate('userId', 'name')
            .sort({ rollNo: 1 });

        const subjectSet = new Set((teacher.subjects || []).filter(Boolean));
        students.forEach((student) => {
            toArray(student.subjects).forEach((subject) => {
                const cleaned = String(subject || '').trim();
                if (cleaned) subjectSet.add(cleaned);
            });
        });
        const subjectOptions = Array.from((teacher.subjects || []).concat(Array.from(subjectSet)));

        const effectiveSubject = selectedSubject || subjectOptions[0] || '';
        const marksMap = {};
        for (const student of students) {
            const existing = (student.marks || []).find(
                (mark) => String(mark.subject || '').trim() === effectiveSubject
                    && String(mark.examType || '').toUpperCase() === selectedExamType
            );
            marksMap[String(student._id)] = existing ? {
                marks: existing.marks,
                outOf: existing.outOf
            } : null;
        }

        res.render('teacher/marks', {
            title: 'Enter Marks',
            teacher,
            classes,
            selectedClassId,
            selectedExamType,
            selectedSubject: effectiveSubject,
            examConfig: EXAM_CONFIG,
            students,
            subjectOptions,
            marksMap
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Submit Marks
router.post('/marks', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const classId = req.body.classId;
        const examType = String(req.body.examType || '').toUpperCase();
        const subject = String(req.body.subject || '').trim();
        const outOf = Number(req.body.outOf);
        const marksInput = req.body.marks || {};

        if (!EXAM_BY_KEY[examType]) {
            req.flash('error_msg', 'Invalid exam type selected');
            return res.redirect('/teacher/marks');
        }

        if (!subject) {
            req.flash('error_msg', 'Please provide a subject');
            return res.redirect('/teacher/marks');
        }

        if (!outOf || outOf <= 0) {
            req.flash('error_msg', 'Please provide valid total marks');
            return res.redirect(`/teacher/marks?classId=${classId}&examType=${examType}&subject=${encodeURIComponent(subject)}`);
        }

        const classAllowed = teacher.classIds.some((item) => String(item._id) === String(classId));
        if (!classAllowed) {
            req.flash('error_msg', 'Access denied for selected class');
            return res.redirect('/teacher/marks');
        }

        const students = await Student.find({
            classId,
            status: 'approved'
        });

        let updatedCount = 0;
        for (const student of students) {
            const key = String(student._id);
            if (!Object.prototype.hasOwnProperty.call(marksInput, key)) continue;

            const marksValue = Number(marksInput[key]);
            if (Number.isNaN(marksValue) || marksValue < 0) continue;

            const existingIndex = (student.marks || []).findIndex(
                (mark) => String(mark.subject || '').trim() === subject
                    && String(mark.examType || '').toUpperCase() === examType
            );

            const markPayload = {
                subject,
                examType,
                marks: marksValue,
                outOf,
                date: new Date()
            };

            if (existingIndex >= 0) student.marks[existingIndex] = markPayload;
            else student.marks.push(markPayload);

            if (!Array.isArray(student.subjects)) {
                student.subjects = [];
            }
            if (!student.subjects.includes(subject)) {
                student.subjects.push(subject);
            }

            await student.save();
            updatedCount += 1;
        }

        req.flash('success_msg', `Marks updated for ${updatedCount} students`);
        res.redirect(`/teacher/marks?classId=${classId}&examType=${examType}&subject=${encodeURIComponent(subject)}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error saving marks');
        res.redirect('/teacher/marks');
    }
});

// Salary View (Teacher - read only)
router.get('/salary', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const month = req.query.month || toMonthKey();
        let salary = await Salary.findOne({ teacherId: teacher._id, month });
        if (!salary) {
            salary = await Salary.create({
                teacherId: teacher._id,
                month,
                baseSalary: Number(teacher.monthlySalary || 0)
            });
        }

        const salaryHistory = await Salary.find({ teacherId: teacher._id })
            .sort({ month: -1 })
            .limit(12);

        res.render('teacher/salary', {
            title: 'My Salary',
            teacher,
            salary,
            salaryHistory,
            selectedMonth: month
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Assignments Management
router.get('/assignments', async (req, res) => {
    try {
        const assignments = await Assignment.find({ teacherId: req.session.user.id })
            .populate('classId', 'name')
            .sort({ createdAt: -1 });

        res.render('teacher/assignments/index', {
            title: 'Manage Assignments',
            assignments
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Add Assignment Form
router.get('/assignments/new', async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        res.render('teacher/assignments/new', {
            title: 'Add New Assignment',
            classes: teacher.classIds,
            selectedClassId: req.query.classId || ''
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading assignment form');
        res.redirect('/teacher/assignments');
    }
});

// Add Assignment
router.post('/assignments', upload.single('file'), async (req, res) => {
    try {
        const teacher = await getTeacherContext(req.session.user.id);
        if (!teacher) {
            req.flash('error_msg', 'Teacher profile not found');
            return res.redirect('/teacher/dashboard');
        }

        const { title, description, classId, subject, dueDate } = req.body;
        const allowedClass = teacher.classIds.some((item) => String(item._id) === String(classId));
        if (!allowedClass) {
            req.flash('error_msg', 'Class not assigned to you');
            return res.redirect('/teacher/assignments/new');
        }

        await Assignment.create({
            title,
            description,
            classId,
            subject,
            dueDate,
            file: req.file ? req.file.filename : null,
            teacherId: req.session.user.id
        });

        req.flash('success_msg', 'Assignment created successfully');
        res.redirect('/teacher/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating assignment');
        res.redirect('/teacher/assignments/new');
    }
});

// View Assignment Submissions
router.get('/assignments/:id/submissions', async (req, res) => {
    try {
        const assignment = await Assignment.findOne({
            _id: req.params.id,
            teacherId: req.session.user.id
        })
            .populate('classId', 'name')
            .populate('submissions.studentId', 'name');

        if (!assignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/teacher/assignments');
        }

        res.render('teacher/assignments/submissions', {
            title: 'Assignment Submissions',
            assignment
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Grade Assignment
router.post('/assignments/:id/grade/:submissionId', async (req, res) => {
    try {
        const { marks, feedback } = req.body;

        const assignment = await Assignment.findOneAndUpdate(
            {
                _id: req.params.id,
                teacherId: req.session.user.id,
                'submissions._id': req.params.submissionId
            },
            {
                $set: {
                    'submissions.$.marks': marks,
                    'submissions.$.feedback': feedback
                }
            }
        );

        if (!assignment) {
            req.flash('error_msg', 'Assignment or submission not found');
            return res.redirect('/teacher/assignments');
        }

        req.flash('success_msg', 'Submission graded successfully');
        res.redirect(`/teacher/assignments/${req.params.id}/submissions`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error grading submission');
        res.redirect(`/teacher/assignments/${req.params.id}/submissions`);
    }
});

// Blog Management
router.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find({ author: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('teacher/blogs/index', {
            title: 'My Blog Posts',
            blogs
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Add Blog Form
router.get('/blogs/new', (req, res) => {
    res.render('teacher/blogs/new', { title: 'Add New Blog Post' });
});

// Add Blog
router.post('/blogs', upload.single('image'), async (req, res) => {
    try {
        const { title, content, category } = req.body;

        await Blog.create({
            title,
            content,
            category,
            author: req.session.user.id,
            image: req.file ? req.file.filename : null
        });

        req.flash('success_msg', 'Blog post created successfully');
        res.redirect('/teacher/blogs');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating blog post');
        res.redirect('/teacher/blogs/new');
    }
});

module.exports = router;
