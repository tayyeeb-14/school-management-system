const express = require('express');
const router = express.Router();
const moment = require('moment');
const { isLoggedIn, isStudent } = require('../middleware/auth');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');
const Fee = require('../models/Fee');
const Blog = require('../models/Blog');
const Attendance = require('../models/Attendance');
const upload = require('../config/multer');
const { DOCUMENT_TYPES } = require('../utils/documentTypes');
const { calculateFinalResult, EXAM_CONFIG, isMarksheetComplete } = require('../utils/marks');
const {
    buildDueEntries,
    buildFeeSummary,
    sortPaymentsByDateDesc,
    toAmount
} = require('../utils/fee');

// Protect all student routes
router.use(isLoggedIn, isStudent);

function resolveStandardMonthlyFee(fee, classFee, fallbackAmount = 0) {
    return toAmount(
        fee?.monthlyFee ||
        classFee?.totalMonthlyFee ||
        fee?.totalDue ||
        fallbackAmount
    );
}

// View Payment Invoice (BEFORE layout middleware so layout: false works)
router.get('/fees/invoice/:paymentIndex', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id })
            .populate('userId')
            .populate('classId');
        
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/student/fees');
        }

        const fee = await Fee.findOne({ studentId: student._id });
        if (!fee || fee.payments.length === 0) {
            req.flash('error_msg', 'Payment not found');
            return res.redirect('/student/fees');
        }

        const paymentIndex = parseInt(req.params.paymentIndex, 10);
        const payment = (typeof fee.payments.id === 'function' ? fee.payments.id(req.params.paymentIndex) : null)
            || fee.payments[paymentIndex];
        
        if (!payment) {
            req.flash('error_msg', 'Payment not found');
            return res.redirect('/student/fees');
        }

        const invoiceNumber = `INV-${Date.now()}-${student._id.toString().slice(-6)}`;

        res.render('student/invoice', {
            layout: false,
            title: 'Payment Invoice',
            student,
            fee,
            payment,
            paymentIndex,
            invoiceNumber,
            moment
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error generating invoice');
        res.redirect('/student/fees');
    }
});

// Use dashboard layout for student routes and set path
router.use((req, res, next) => {
    res.locals.layout = 'layouts/dashboard';
    res.locals.path = req.path;  // Add this line to set path for all routes
    next();
});

// Student Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/');
        }
        
        // Get pending assignments
        const pendingAssignments = await Assignment.find({
            classId: student.classId,
            dueDate: { $gt: new Date() },
            'submissions.studentId': { $ne: req.session.user.id }
        }).sort({ dueDate: 1 }).limit(5);

        // Get recent submissions
        const recentSubmissions = await Assignment.find({
            'submissions.studentId': req.session.user.id
        }).sort({ 'submissions.submittedAt': -1 }).limit(5);

        // Calculate attendance percentage from class/date attendance records
        const attendanceRecords = await Attendance.find({
            classId: student.classId,
            'entries.studentId': student._id
        }).select('entries');

        let totalAttendanceEntries = 0;
        let totalPresent = 0;
        for (const record of attendanceRecords) {
            const entry = record.entries.find((item) => String(item.studentId) === String(student._id));
            if (!entry) continue;
            totalAttendanceEntries += 1;
            if (entry.status === 'present') totalPresent += 1;
        }
        const attendancePercentage = totalAttendanceEntries
            ? Math.round((totalPresent / totalAttendanceEntries) * 100)
            : 0;

        res.render('student/dashboard', {
            title: 'Student Dashboard',
            student,
            pendingAssignments,
            recentSubmissions,
            attendancePercentage
                ,
                path: req.path
            });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Student Documents
router.get('/documents', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id })
            .populate('userId')
            .populate('classId');

        if (!student) {
            req.flash('error_msg', 'Student record not found');
            return res.redirect('/student/dashboard');
        }

        res.render('student/documents', {
            title: 'My Documents',
            student,
            documentTypes: DOCUMENT_TYPES,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading documents');
        res.redirect('/student/dashboard');
    }
});

// View Assignments
router.get('/assignments', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        
        const assignments = await Assignment.find({ classId: student.classId })
            .sort({ createdAt: -1 })
            .populate('submissions.studentId', 'name');

        res.render('student/assignments/index', {
            title: 'My Assignments',
            assignments,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Submit Assignment
router.post('/assignments/:id/submit', upload.single('file'), async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        
        if (!assignment) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect('/student/assignments');
        }

        if (new Date() > assignment.dueDate) {
            req.flash('error_msg', 'Assignment due date has passed');
            return res.redirect('/student/assignments');
        }

        const submission = {
            studentId: req.session.user.id,
            file: req.file.filename,
            submittedAt: new Date()
        };

        assignment.submissions.push(submission);
        await assignment.save();

        req.flash('success_msg', 'Assignment submitted successfully');
        res.redirect('/student/assignments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error submitting assignment');
        res.redirect('/student/assignments');
    }
});

// View Attendance
router.get('/attendance', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/student/dashboard');
        }
        
        const attendanceRecords = await Attendance.find({
            classId: student.classId,
            'entries.studentId': student._id
        }).sort({ date: -1 });

        const attendance = attendanceRecords.map((record) => {
            const entry = record.entries.find((item) => String(item.studentId) === String(student._id));
            return {
                date: record.date,
                status: entry?.status || 'absent'
            };
        });

        const total = attendance.length;
        const present = attendance.filter((item) => item.status === 'present').length;
        const attendancePercentage = total ? Math.round((present / total) * 100) : 0;

        res.render('student/attendance', {
            title: 'My Attendance',
            attendance,
            attendancePercentage
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// View Study Materials
router.get('/materials', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        
        // You would typically fetch study materials from your database
        // This is a placeholder structure
        const materials = [
            { title: 'Mathematics Notes', type: 'PDF', url: '/materials/math-notes.pdf' },
            { title: 'Science Lab Manual', type: 'PDF', url: '/materials/science-lab.pdf' },
            { title: 'History Timeline', type: 'Document', url: '/materials/history-timeline.docx' }
        ];

        res.render('student/materials', {
            title: 'Study Materials',
            materials,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// View Class Timetable
router.get('/timetable', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        
        // You would typically fetch the timetable from your database
        // This is a placeholder structure
        const timetable = {
            monday: [
                { time: '9:00 AM', subject: 'Mathematics' },
                { time: '10:00 AM', subject: 'Science' },
                { time: '11:00 AM', subject: 'English' }
            ],
            tuesday: [
                { time: '9:00 AM', subject: 'History' },
                { time: '10:00 AM', subject: 'Geography' },
                { time: '11:00 AM', subject: 'Computer Science' }
            ]
            // Add other days similarly
        };

        res.render('student/timetable', {
            title: 'Class Timetable',
            timetable,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// View Result Report
router.get('/results', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id });
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/student/dashboard');
        }

        const completion = isMarksheetComplete(student);
        const resultData = calculateFinalResult(student);

        res.render('student/results', {
            title: 'My Results',
            resultData,
            completion,
            examConfig: EXAM_CONFIG
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Blog Comments
router.post('/blog/:id/comment', async (req, res) => {
    try {
        const { content } = req.body;

        await Blog.findByIdAndUpdate(req.params.id, {
            $push: {
                comments: {
                    user: req.session.user.id,
                    content,
                    date: new Date()
                }
            }
        });

        req.flash('success_msg', 'Comment added successfully');
        res.redirect(`/blog/${req.params.id}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error adding comment');
        res.redirect(`/blog/${req.params.id}`);
    }
});

// Toggle Blog Like
router.post('/blog/:id/like', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        const userLiked = blog.likes.includes(req.session.user.id);
        
        if (userLiked) {
            blog.likes.pull(req.session.user.id);
        } else {
            blog.likes.push(req.session.user.id);
        }
        
        await blog.save();

        res.json({ success: true, liked: !userLiked });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// View Fee Details
router.get('/fees', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.session.user.id })
            .populate('classId');
        
        if (!student) {
            req.flash('error_msg', 'Student record not found');
            return res.redirect('/student/dashboard');
        }

        let fee = await Fee.findOne({ studentId: student._id });
        if (!fee) {
            fee = await Fee.create({ studentId: student._id });
        }

        const ClassFee = require('../models/ClassFee');
        const classFee = student.classId ? await ClassFee.findOne({ classId: student.classId._id }) : null;
        const standardMonthlyFee = resolveStandardMonthlyFee(fee, classFee);

        let shouldSave = false;
        if ((!fee.totalDue || fee.totalDue === 0) && standardMonthlyFee > 0) {
            fee.totalDue = standardMonthlyFee;
            shouldSave = true;
        }
        if ((!fee.monthlyFee || fee.monthlyFee === 0) && standardMonthlyFee > 0) {
            fee.monthlyFee = standardMonthlyFee;
            shouldSave = true;
        }
        if (shouldSave) {
            await fee.save();
        }

        const summary = buildFeeSummary(fee, { standardMonthlyFee });
        const dueEntries = buildDueEntries(fee.monthlyDues, new Date());
        const overdues = dueEntries.filter((entry) => entry.isOverdue);
        const upcomingDues = dueEntries.filter((entry) => !entry.isOverdue && !entry.isPaid);
        const sortedPayments = sortPaymentsByDateDesc(fee.payments);

        res.render('student/fees', {
            title: 'My Fees',
            student,
            fee,
            classFee,
            standardMonthlyFee,
            summary,
            totalPaid: summary.totalPaid,
            balance: summary.outstandingBalance,
            dueEntries,
            sortedPayments,
            overdues,
            upcomingDues,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

module.exports = router;
