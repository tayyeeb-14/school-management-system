const express = require('express');
const router = express.Router();
const { isLoggedIn, isTeacher } = require('../middleware/auth');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const Blog = require('../models/Blog');
const upload = require('../config/multer');

// Protect all teacher routes
router.use(isLoggedIn, isTeacher);

// Use dashboard layout for teacher routes and set path
router.use((req, res, next) => {
    res.locals.layout = 'layouts/dashboard';
    res.locals.path = req.path;  // Add this line to set path for all routes
    next();
});

// Teacher Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.session.user.id });
        
        const stats = {
            assignments: await Assignment.countDocuments({ teacherId: req.session.user.id }),
            pendingSubmissions: await Assignment.aggregate([
                { $match: { teacherId: req.session.user.id } },
                { $unwind: '$submissions' },
                { $match: { 'submissions.marks': null } },
                { $count: 'count' }
            ]).then(result => result[0]?.count || 0)
        };

        const recentAssignments = await Assignment.find({ teacherId: req.session.user.id })
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('teacher/dashboard', {
            title: 'Teacher Dashboard',
            teacher,
            stats,
            assignments: recentAssignments
                ,
                path: req.path
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
router.get('/assignments/new', (req, res) => {
    res.render('teacher/assignments/new', { title: 'Add New Assignment' });
});

// Add Assignment
router.post('/assignments', upload.single('file'), async (req, res) => {
    try {
        const { title, description, class: className, subject, dueDate } = req.body;

        // Find the class
        const classDoc = await Class.findOne({ name: className });
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/teacher/assignments/new');
        }

        await Assignment.create({
            title,
            description,
            classId: classDoc._id,
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
        }).populate('submissions.studentId', 'name');

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

// Mark Attendance Form
router.get('/attendance', async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.session.user.id });
        const students = await Student.find({ classId: { $in: teacher.classIds } })
            .populate('userId', 'name');

        res.render('teacher/attendance', {
            title: 'Mark Attendance',
            students,
            classes: teacher.classes
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Submit Attendance
router.post('/attendance', async (req, res) => {
    try {
        const { date, students } = req.body;
        
        // students is an object with student IDs as keys and attendance status as values
        for (const [studentId, status] of Object.entries(students)) {
            await Student.findByIdAndUpdate(studentId, {
                $push: {
                    attendance: {
                        date: new Date(date),
                        status
                    }
                }
            });
        }

        req.flash('success_msg', 'Attendance marked successfully');
        res.redirect('/teacher/attendance');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error marking attendance');
        res.redirect('/teacher/attendance');
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