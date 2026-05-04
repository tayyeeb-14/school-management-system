const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Fee = require('../models/Fee');
const ClassFee = require('../models/ClassFee');
const Blog = require('../models/Blog');
const Notice = require('../models/Notice');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const upload = require('../config/multer');
const { documentTypes } = require('../utils/documentTypes');
const { calculateFinalResult, isMarksheetComplete } = require('../utils/marks');
const {
    applyPaymentRecord,
    buildDueEntries,
    buildFeeSummary,
    ensureMonthlyDue,
    getDefaultDueDate,
    getMonthOptions,
    normaliseDue,
    rebuildDueLedger,
    sortPaymentsByDateDesc,
    toAmount
} = require('../utils/fee');

// Protect all admin routes
router.use(isLoggedIn, isAdmin);

// Use dashboard layout for admin routes and set path
router.use((req, res, next) => {
    res.locals.layout = 'layouts/dashboard';
    res.locals.path = req.path;  // Add this line to set path for all routes
    next();
});

function resolveStandardMonthlyFee(fee, classFee, fallbackAmount = 0) {
    return toAmount(
        // prefer explicit student monthlyFee, then class-calculated monthly total,
        // avoid using `totalDue` (a lump-sum) as a per-month fallback
        fee?.monthlyFee ||
        classFee?.calculatedMonthlyFee ||
        fallbackAmount
    );
}

function toMonthKey(dateInput = new Date()) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function toStartOfDay(dateInput = new Date()) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const stats = {
            students: await User.countDocuments({ role: 'student' }),
            teachers: await User.countDocuments({ role: 'teacher' }),
            blogs: await Blog.countDocuments(),
            notices: await Notice.countDocuments()
        };
        
        const recentNotices = await Notice.find()
            .sort({ date: -1 })
            .limit(5);
            
        const recentBlogs = await Blog.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('author', 'name');

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            notices: recentNotices,
            blogs: recentBlogs
                ,
                path: req.path
            });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Students Management
router.get('/students', async (req, res) => {
    try {
        const students = await Student.find({ status: 'approved' })
            .populate('userId', 'name username email')
            .populate('classId', 'name')
            .sort({ 'classId.name': 1, rollNo: 1 });

        const pendingStudents = await Student.find({ status: 'pending' })
            .populate('userId', 'name username email')
            .populate('classId', 'name')
            .sort({ createdAt: -1 });
            
        res.render('admin/students/index', {
            title: 'Manage Students',
            students,
            pendingStudents,
            documentTypes
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Add Student Form
router.get('/students/new', (req, res) => {
    res.render('admin/students/new', { title: 'Add New Student' });
});

// Add Student
router.post('/students', (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Multer error in student creation:', err);
            req.flash('error_msg', err.message || 'File upload error');
            return res.redirect('/admin/students/new');
        }
        next();
    });
}, async (req, res) => {
    try {
        const { username, password, name, email, class: className, rollNo, phone, fatherName } = req.body;
        // Basic validation
        if (!username || !password || !name || !email || !className || !rollNo) {
            req.flash('error_msg', 'Please fill in all required fields');
            return res.redirect('/admin/students/new');
        }

        // Find or create class (moved earlier so we can check rollNo per class)
        let classDoc = await Class.findOne({ name: className });
        if (!classDoc) {
            classDoc = await Class.create({ name: className });
        }

        // Check for duplicate username globally
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            req.flash('error_msg', 'Username already exists');
            return res.redirect('/admin/students/new');
        }

        // Check for duplicate roll number within the same class
        const existingRollNo = await Student.findOne({ rollNo, classId: classDoc._id });
        if (existingRollNo) {
            req.flash('error_msg', 'Roll number already exists in this class');
            return res.redirect('/admin/students/new');
        }
        const user = await User.create({
            username,
            password,
            name,
            email,
            phone: phone || undefined,
            role: 'student',
            photo: req.file ? req.file.filename : 'default.jpg'
        });
        try {
            const student = await Student.create({
                userId: user._id,
                classId: classDoc._id,
                rollNo,
                fatherName
            });
            // Add student to class
            classDoc.students.push(student._id);
            await classDoc.save();
        } catch (studentError) {
            console.error('Student creation failed, deleting user:', studentError);
            // If student creation fails, delete the user to avoid orphaned records
            await User.findByIdAndDelete(user._id);
            throw studentError;
        }
        req.flash('success_msg', 'Student added successfully');
        res.redirect('/admin/students');
    } catch (error) {
        console.error('=== Error Adding Student ===');
        console.error('Error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Show specific error to help debugging
        let errorMessage = 'Error adding student';
        if (error.code === 11000) {
            // MongoDB duplicate key error
            if (error.keyPattern && error.keyPattern.rollNo) {
                errorMessage = 'Roll number already exists';
            } else if (error.keyPattern && error.keyPattern.username) {
                errorMessage = 'Username already exists';
            } else if (error.keyPattern && error.keyPattern.email) {
                errorMessage = 'Email already exists';
            } else {
                errorMessage = 'Duplicate entry detected. Please check your input.';
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        req.flash('error_msg', errorMessage);
        res.redirect('/admin/students/new');
    }
});

// Approve Student Form
router.get('/students/:id/approve', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('userId')
            .populate('classId', 'name');
        
        if (!student || student.status !== 'pending') {
            req.flash('error_msg', 'Student not found or already approved');
            return res.redirect('/admin/students');
        }

        res.render('admin/students/approve', {
            title: 'Approve Student',
            student
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading student');
        res.redirect('/admin/students');
    }
});

// Approve Student
router.post('/students/:id/approve', async (req, res) => {
    try {
        const { rollNo } = req.body;
        const studentId = req.params.id;

        const student = await Student.findById(studentId);
        if (!student || student.status !== 'pending') {
            req.flash('error_msg', 'Student not found or already approved');
            return res.redirect('/admin/students');
        }

        // Check if roll number is unique within the same class
        const existingRollNo = await Student.findOne({
            rollNo,
            status: 'approved',
            classId: student.classId,
            _id: { $ne: studentId }
        });
        if (existingRollNo) {
            req.flash('error_msg', 'Roll number already exists in this class');
            return res.redirect(`/admin/students/${studentId}/approve`);
        }

        await Student.findByIdAndUpdate(studentId, {
            rollNo,
            status: 'approved'
        });

        // Add student to class if not already
        const classDoc = await Class.findById(student.classId);
        if (classDoc && !classDoc.students.includes(studentId)) {
            classDoc.students.push(studentId);
            await classDoc.save();
        }

        req.flash('success_msg', 'Student approved successfully');
        res.redirect('/admin/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error approving student');
        res.redirect('/admin/students');
    }
});

// Edit Student Form
router.get('/students/:id/edit', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('userId')
            .populate('classId', 'name');
        
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        res.render('admin/students/edit', {
            title: 'Edit Student',
            student
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading student');
        res.redirect('/admin/students');
    }
});

// Update Student
router.put('/students/:id', upload.single('photo'), async (req, res) => {
    try {
        const { name, email, phone, class: className, rollNo, fatherName } = req.body;
        const studentId = req.params.id;

        const student = await Student.findById(studentId).populate('userId');
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        // Find or create class
        let classDoc = await Class.findOne({ name: className });
        if (!classDoc) {
            classDoc = await Class.create({ name: className });
        }

        // Check for duplicate roll number within the target class (exclude current student)
        const duplicate = await Student.findOne({ rollNo, classId: classDoc._id, _id: { $ne: studentId } });
        if (duplicate) {
            req.flash('error_msg', 'Roll number already exists in this class');
            return res.redirect(`/admin/students/${studentId}/edit`);
        }

        // Update user info
        const updateData = { name, email };
        if (phone !== undefined) updateData.phone = phone;
        if (req.file) updateData.photo = req.file.filename;

        await User.findByIdAndUpdate(student.userId._id, updateData);

        // Update student info
        await Student.findByIdAndUpdate(studentId, {
            classId: classDoc._id,
            rollNo,
            fatherName
        });

        req.flash('success_msg', 'Student updated successfully');
        res.redirect('/admin/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating student');
        res.redirect('/admin/students');
    }
});

// Delete Student
router.delete('/students/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('userId');
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        // Remove student from class
        if (student.classId) {
            await Class.findByIdAndUpdate(student.classId, {
                $pull: { students: student._id }
            });
        }

        // Delete student profile
        await Student.findByIdAndDelete(req.params.id);

        // Delete user account
        await User.findByIdAndDelete(student.userId._id);

        req.flash('success_msg', 'Student deleted successfully');
        res.redirect('/admin/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting student');
        res.redirect('/admin/students');
    }
});

// Teachers Management
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find()
            .populate('userId', 'name username email')
            .populate('classIds', 'name');
            
        res.render('admin/teachers/index', {
            title: 'Manage Teachers',
            teachers
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Add Teacher Form
router.get('/teachers/new', async (req, res) => {
    try {
        const classes = await Class.find().sort({ name: 1 });
        res.render('admin/teachers/new', {
            title: 'Add New Teacher',
            classes
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading teacher form');
        res.redirect('/admin/teachers');
    }
});

// Add Teacher
router.post('/teachers', (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            req.flash('error_msg', err.message || 'File upload error');
            return res.redirect('/admin/teachers/new');
        }
        next();
    });
}, async (req, res) => {
    try {
        const {
            username,
            password,
            name,
            email,
            subject,
            qualifications,
            monthlySalary
        } = req.body;
        const classIdsRaw = req.body.classIds || [];
        const classIds = Array.isArray(classIdsRaw) ? classIdsRaw.filter(Boolean) : [classIdsRaw].filter(Boolean);

        // Basic validation
        if (!username || !password || !name || !email || !subject) {
            req.flash('error_msg', 'Please fill in all required fields');
            return res.redirect('/admin/teachers/new');
        }

        // Check for duplicate username globally
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            req.flash('error_msg', 'Username already exists');
            return res.redirect('/admin/teachers/new');
        }

        const user = await User.create({
            username,
            password,
            name,
            email,
            role: 'teacher',
            photo: req.file ? req.file.filename : 'default.jpg'
        });

        const teacher = await Teacher.create({
            userId: user._id,
            subject,
            qualifications,
            classIds,
            monthlySalary: toAmount(monthlySalary)
        });

        if (classIds.length > 0) {
            await Class.updateMany(
                { _id: { $in: classIds } },
                { $set: { teacherId: teacher._id } }
            );
        }

        req.flash('success_msg', 'Teacher added successfully');
        return res.redirect('/admin/teachers');
    } catch (error) {
        console.error(error);
        // Show specific error to help debugging (will appear in UI flash)
        req.flash('error_msg', error.message || 'Error adding teacher');
        return res.redirect('/admin/teachers/new');
    }
});

// Edit Teacher Form
router.get('/teachers/:id/edit', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id)
            .populate('userId')
            .populate('classIds', 'name');
        if (!teacher) {
            req.flash('error_msg', 'Teacher not found');
            return res.redirect('/admin/teachers');
        }

        const classes = await Class.find().sort({ name: 1 });
        res.render('admin/teachers/edit', {
            title: 'Edit Teacher',
            teacher,
            classes
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading teacher edit form');
        res.redirect('/admin/teachers');
    }
});

// Update Teacher
router.put('/teachers/:id', upload.single('photo'), async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id).populate('userId');
        if (!teacher) {
            req.flash('error_msg', 'Teacher not found');
            return res.redirect('/admin/teachers');
        }

        const {
            name,
            email,
            subjects,
            qualifications,
            monthlySalary
        } = req.body;
        const classIdsRaw = req.body.classIds || [];
        const classIds = Array.isArray(classIdsRaw) ? classIdsRaw.filter(Boolean) : [classIdsRaw].filter(Boolean);

        const userUpdate = { name, email };
        if (req.file) userUpdate.photo = req.file.filename;
        await User.findByIdAndUpdate(teacher.userId._id, userUpdate);

        // Accept comma-separated subjects or single value
        if (typeof subjects === 'string') {
            teacher.subjects = subjects.split(',').map(s => String(s || '').trim()).filter(Boolean);
        } else if (Array.isArray(subjects)) {
            teacher.subjects = subjects.map(s => String(s || '').trim()).filter(Boolean);
        } else {
            teacher.subjects = [];
        }
        teacher.qualifications = qualifications;
        teacher.monthlySalary = toAmount(monthlySalary);
        teacher.classIds = classIds;
        await teacher.save();

        await Class.updateMany({ teacherId: teacher._id }, { $unset: { teacherId: 1 } });
        if (classIds.length > 0) {
            await Class.updateMany({ _id: { $in: classIds } }, { $set: { teacherId: teacher._id } });
        }

        req.flash('success_msg', 'Teacher updated successfully');
        res.redirect('/admin/teachers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating teacher');
        res.redirect('/admin/teachers');
    }
});

// Teacher Salary Details
router.get('/teachers/:id/salary', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id).populate('userId');
        if (!teacher) {
            req.flash('error_msg', 'Teacher not found');
            return res.redirect('/admin/teachers');
        }

        const month = req.query.month || toMonthKey();
        let salary = await Salary.findOne({ teacherId: teacher._id, month });
        if (!salary) {
            salary = await Salary.create({
                teacherId: teacher._id,
                month,
                baseSalary: toAmount(teacher.monthlySalary)
            });
        }

        const salaryHistory = await Salary.find({ teacherId: teacher._id })
            .sort({ month: -1 })
            .limit(12);

        res.render('admin/teachers/salary', {
            title: 'Teacher Salary Management',
            teacher,
            salary,
            salaryHistory,
            selectedMonth: month
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading salary details');
        res.redirect('/admin/teachers');
    }
});

// Add Salary Payment
router.post('/teachers/:id/salary/pay', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id).populate('userId');
        if (!teacher) {
            req.flash('error_msg', 'Teacher not found');
            return res.redirect('/admin/teachers');
        }

        const month = req.body.month || toMonthKey();
        const amount = toAmount(req.body.amount);
        const note = req.body.note;

        if (!amount || amount <= 0) {
            req.flash('error_msg', 'Please enter a valid payment amount');
            return res.redirect(`/admin/teachers/${req.params.id}/salary?month=${month}`);
        }

        let salary = await Salary.findOne({ teacherId: teacher._id, month });
        if (!salary) {
            salary = await Salary.create({
                teacherId: teacher._id,
                month,
                baseSalary: toAmount(teacher.monthlySalary)
            });
        }

        salary.payments.push({
            amount,
            note,
            paidBy: req.session.user.id
        });
        salary.recalculate();
        await salary.save();

        req.flash('success_msg', 'Salary payment recorded successfully');
        res.redirect(`/admin/teachers/${req.params.id}/salary?month=${month}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error recording salary payment');
        res.redirect('/admin/teachers');
    }
});

// Delete Teacher
router.delete('/teachers/:id', async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id).populate('userId');
        if (!teacher) {
            req.flash('error_msg', 'Teacher not found');
            return res.redirect('/admin/teachers');
        }

        await Class.updateMany({ teacherId: teacher._id }, { $unset: { teacherId: 1 } });
        await Salary.deleteMany({ teacherId: teacher._id });
        await Teacher.findByIdAndDelete(req.params.id);

        if (teacher.userId) {
            await User.findByIdAndDelete(teacher.userId._id);
        }

        req.flash('success_msg', 'Teacher deleted successfully');
        res.redirect('/admin/teachers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting teacher');
        res.redirect('/admin/teachers');
    }
});

// Blog Management
router.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .populate('author', 'name');
            
        res.render('admin/blogs/index', {
            title: 'Manage Blogs',
            blogs
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Fee Management - View Student Fee Details
router.get('/students/:id/fees', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('userId')
            .populate('classId');
        
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        const classFee = student.classId ? await ClassFee.findOne({ classId: student.classId._id }) : null;
        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

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
        const sortedPayments = sortPaymentsByDateDesc(fee.payments);

        res.render('admin/students/fees', {
            title: 'Student Fee Management',
            student,
            fee,
            classFee,
            standardMonthlyFee,
            summary,
            totalPaid: summary.totalPaid,
            balance: summary.outstandingBalance,
            dueEntries,
            sortedPayments,
            monthOptions: getMonthOptions({ monthsBack: 12, monthsForward: 12 })
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading fee details');
        res.redirect('/admin/students');
    }
});

// Update Monthly Fee
router.post('/students/:id/fees/update-monthly', async (req, res) => {
    try {
        const { monthlyFee, totalDue } = req.body;

        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        const resolvedMonthlyFee = toAmount(monthlyFee);
        const resolvedTotalDue = toAmount(totalDue) || resolvedMonthlyFee;

        fee.monthlyFee = resolvedMonthlyFee;
        fee.totalDue = resolvedTotalDue;
        await fee.save();

        req.flash('success_msg', 'Student fee settings updated successfully');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating fee details');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    }
});

// Add Payment
router.post('/students/:id/fees/add-payment', async (req, res) => {
    try {
        const { amount, month, description, monthlyDueId } = req.body;

        const resolvedAmount = toAmount(amount);
        if (!resolvedAmount || !month) {
            req.flash('error_msg', 'Please provide both month and payment amount');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        const student = await Student.findById(req.params.id).populate('classId');
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }
        const classFee = student?.classId ? await ClassFee.findOne({ classId: student.classId._id }) : null;
        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        const standardMonthlyFee = resolveStandardMonthlyFee(fee, classFee, resolvedAmount);
        if ((!fee.totalDue || fee.totalDue === 0) && standardMonthlyFee > 0) {
            fee.totalDue = standardMonthlyFee;
        }
        if ((!fee.monthlyFee || fee.monthlyFee === 0) && standardMonthlyFee > 0) {
            fee.monthlyFee = standardMonthlyFee;
        }

        const { payment } = applyPaymentRecord(fee, {
            amount: resolvedAmount,
            month,
            description,
            monthlyDueId: monthlyDueId || null,
            standardMonthlyFee,
            collectedFromClass: false
        });

        await fee.save();

        req.flash('success_msg', `Payment of ${resolvedAmount.toFixed(2)} recorded for ${month}`);
        res.redirect(`/admin/students/${req.params.id}/fees/invoice?paymentId=${payment._id}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error recording payment');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    }
});

// View Invoice
router.get('/students/:id/fees/invoice', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('userId')
            .populate('classId');
        
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/admin/students');
        }

        const fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee || fee.payments.length === 0) {
            req.flash('error_msg', 'No payment found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        const requestedPaymentId = req.query.paymentId;
        const selectedPayment = requestedPaymentId && typeof fee.payments.id === 'function'
            ? fee.payments.id(requestedPaymentId)
            : null;
        const lastPayment = selectedPayment || fee.payments[fee.payments.length - 1];
        const invoiceNumber = `INV-${Date.now()}-${req.params.id.slice(-6)}`;

        res.render('admin/students/invoice', {
            layout: false,
            title: 'Payment Invoice',
            student,
            fee,
            payment: lastPayment,
            invoiceNumber
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error generating invoice');
        res.redirect('/admin/students');
    }
});

// Add Monthly Due
router.post('/students/:id/fees/add-monthly-due', async (req, res) => {
    try {
        const { month, dueAmount, dueDate } = req.body;

        const resolvedDueAmount = toAmount(dueAmount);
        if (!month || !resolvedDueAmount) {
            req.flash('error_msg', 'Please provide a valid month and due amount');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        const existingDue = fee.monthlyDues.find((entry) => String(entry.month).toLowerCase() === String(month).toLowerCase());
        const monthlyDue = ensureMonthlyDue(fee, {
            month,
            dueAmount: resolvedDueAmount,
            dueDate: dueDate ? new Date(dueDate) : getDefaultDueDate(month)
        });

        if ((!fee.totalDue || fee.totalDue === 0) && resolvedDueAmount > 0) {
            fee.totalDue = resolvedDueAmount;
        }
        if ((!fee.monthlyFee || fee.monthlyFee === 0) && resolvedDueAmount > 0) {
            fee.monthlyFee = resolvedDueAmount;
        }

        monthlyDue.dueAmount = resolvedDueAmount;
        monthlyDue.dueDate = dueDate ? new Date(dueDate) : monthlyDue.dueDate || getDefaultDueDate(month);
        normaliseDue(monthlyDue);
        await fee.save();

        req.flash('success_msg', existingDue ? 'Monthly due updated successfully' : 'Monthly due added successfully');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error adding monthly due');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    }
});

// Delete Monthly Due
router.delete('/students/:id/fees/monthly-due/:dueId', async (req, res) => {
    try {
        const fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            req.flash('error_msg', 'Fee record not found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        const due = fee.monthlyDues.id(req.params.dueId);
        if (!due) {
            req.flash('error_msg', 'Monthly due not found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        const linkedPayments = fee.payments.filter((payment) => String(payment.month).toLowerCase() === String(due.month).toLowerCase());
        if (linkedPayments.length > 0) {
            req.flash('error_msg', 'Delete the linked payment(s) for this month before removing the due');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        due.deleteOne();
        await fee.save();

        req.flash('success_msg', 'Monthly due deleted successfully');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting monthly due');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    }
});

// Delete Payment
router.delete('/students/:id/fees/payment/:paymentId', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('classId');
        const classFee = student?.classId ? await ClassFee.findOne({ classId: student.classId._id }) : null;
        const fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            req.flash('error_msg', 'Fee record not found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        const payment = fee.payments.id(req.params.paymentId);
        if (!payment) {
            req.flash('error_msg', 'Payment record not found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        payment.deleteOne();
        rebuildDueLedger(fee, {
            standardMonthlyFee: resolveStandardMonthlyFee(fee, classFee)
        });
        await fee.save();

        req.flash('success_msg', 'Payment deleted successfully');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting payment');
        res.redirect(`/admin/students/${req.params.id}/fees`);
    }
});

// Class Fee Management - View all classes with fees
router.get('/classes/fees', async (req, res) => {
    try {
        const classes = await Class.find().sort({ name: 1 });
        
        // Get fees for each class
        const classesWithFees = await Promise.all(
            classes.map(async (cls) => {
                const fee = await ClassFee.findOne({ classId: cls._id });
                return {
                    ...cls.toObject(),
                    classFee: fee
                };
            })
        );
        
        res.render('admin/classes/fees', {
            title: 'Class Fee Management',
            classesWithFees
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading class fees');
        res.redirect('/admin/dashboard');
    }
});

// Class Fee Management - Edit specific class fees
router.get('/classes/:id/fees/edit', async (req, res) => {
    try {
        const classDoc = await Class.findById(req.params.id);
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/admin/classes/fees');
        }

        let classFee = await ClassFee.findOne({ classId: req.params.id });
        if (!classFee) {
            classFee = await ClassFee.create({ classId: req.params.id });
        }

        res.render('admin/classes/edit-fees', {
            title: 'Edit Class Fees',
            classDoc,
            classFee
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading class fees');
        res.redirect('/admin/classes/fees');
    }
});

// Add Fee Type to Class
router.post('/classes/:id/fees/add-fee', async (req, res) => {
    try {
        const { name, amount, frequency } = req.body;
        
        let classFee = await ClassFee.findOne({ classId: req.params.id });
        if (!classFee) {
            classFee = await ClassFee.create({ classId: req.params.id });
        }

        classFee.fees.push({
            name,
            amount: parseFloat(amount),
            frequency: frequency || 'monthly'
        });
        
        // Update total monthly fee
        classFee.totalMonthlyFee = classFee.fees
            .filter(f => f.frequency === 'monthly')
            .reduce((sum, f) => sum + f.amount, 0);
        
        await classFee.save();

        req.flash('success_msg', 'Fee type added successfully');
        res.redirect(`/admin/classes/${req.params.id}/fees/edit`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error adding fee type');
        res.redirect(`/admin/classes/${req.params.id}/fees/edit`);
    }
});

// Delete Fee Type from Class
router.delete('/classes/:id/fees/:feeId', async (req, res) => {
    try {
        const classFee = await ClassFee.findOne({ classId: req.params.id });
        if (!classFee) {
            req.flash('error_msg', 'Class fee not found');
            return res.redirect('/admin/classes/fees');
        }

        const feeId = req.params.feeId;

        // Ensure classFee is fetched correctly (by classId)
        // classId in ClassFee refers to the Class document id
        if (!classFee) {
            req.flash('error_msg', 'Class fee not found');
            return res.redirect('/admin/classes/fees');
        }

        // Check existence of feeId in the fees array
        const exists = classFee.fees.some(f => String(f._id) === String(feeId));
        if (!exists) {
            console.warn('Attempt to delete non-existent fee id in array', { classId: req.params.id, feeId });
            req.flash('error_msg', 'Requested fee type was not found');
            return res.redirect(`/admin/classes/${req.params.id}/fees/edit`);
        }

        // Pull by id and save
        classFee.fees.pull(feeId);

        // Recalculate total monthly fee
        classFee.totalMonthlyFee = classFee.fees
            .filter(f => f.frequency === 'monthly')
            .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

        await classFee.save();

        req.flash('success_msg', 'Fee type deleted successfully');
        res.redirect(`/admin/classes/${req.params.id}/fees/edit`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting fee type');
        res.redirect('/admin/classes/fees');
    }
});

// Add Blog Form
router.get('/blogs/new', (req, res) => {
    res.render('admin/blogs/new', { title: 'Add New Blog Post' });
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
        res.redirect('/admin/blogs');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating blog post');
        res.redirect('/admin/blogs/new');
    }
});

// Delete Blog
router.delete('/blogs/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            req.flash('error_msg', 'Blog post not found');
            return res.redirect('/admin/blogs');
        }
        await Blog.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Blog post deleted successfully');
        res.redirect('/admin/blogs');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting blog post');
        res.redirect('/admin/blogs');
    }
});

// Notice Management
router.get('/notices', async (req, res) => {
    try {
        const notices = await Notice.find()
            .sort({ date: -1 });
            
        res.render('admin/notices/index', {
            title: 'Manage Notices',
            notices
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Add Notice Form
router.get('/notices/new', (req, res) => {
    res.render('admin/notices/new', { title: 'Add New Notice' });
});

// Add Notice
router.post('/notices', upload.single('file'), async (req, res) => {
    try {
        const { title, description, category, forClass } = req.body;
        
        await Notice.create({
            title,
            description,
            category,
            forClass,
            file: req.file ? req.file.filename : null,
            createdBy: req.session.user.id
        });

        req.flash('success_msg', 'Notice created successfully');
        res.redirect('/admin/notices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating notice');
        res.redirect('/admin/notices/new');
    }
});

// Delete Notice
router.delete('/notices/:id', async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            req.flash('error_msg', 'Notice not found');
            return res.redirect('/admin/notices');
        }
        await Notice.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Notice deleted successfully');
        res.redirect('/admin/notices');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting notice');
        res.redirect('/admin/notices');
    }
});

// Attendance Overview (Admin)
router.get('/attendance', async (req, res) => {
    try {
        const selectedDate = toStartOfDay(req.query.date || new Date());
        const selectedClassId = req.query.classId || '';

        const classes = await Class.find().sort({ name: 1 });
        const classFilter = selectedClassId ? { classId: selectedClassId } : {};
        const dateFilter = selectedDate ? {
            date: {
                $gte: selectedDate,
                $lte: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1)
            }
        } : {};

        const records = await Attendance.find({
            ...classFilter,
            ...dateFilter
        })
            .populate('classId', 'name')
            .populate('entries.studentId', 'rollNo')
            .sort({ date: -1 });

        const attendanceRows = records.map((record) => {
            const total = record.entries.length;
            const present = record.entries.filter((entry) => entry.status === 'present').length;
            const absent = Math.max(0, total - present);
            const percentage = total ? Math.round((present / total) * 100) : 0;
            return {
                record,
                total,
                present,
                absent,
                percentage
            };
        });

        res.render('admin/attendance', {
            title: 'Attendance Overview',
            classes,
            selectedClassId,
            selectedDate: selectedDate ? selectedDate.toISOString().slice(0, 10) : '',
            attendanceRows
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading attendance overview');
        res.redirect('/admin/dashboard');
    }
});

// Marks Overview (Admin)
router.get('/marks', async (req, res) => {
    try {
        const selectedClassId = req.query.classId || '';
        const classes = await Class.find().sort({ name: 1 });

        const studentFilter = selectedClassId ? { classId: selectedClassId, status: 'approved' } : { status: 'approved' };
        const students = await Student.find(studentFilter)
            .populate('userId', 'name')
            .populate('classId', 'name')
            .sort({ 'classId.name': 1, rollNo: 1 });

        const resultRows = students.map((student) => {
            const completion = isMarksheetComplete(student);
            const finalResult = calculateFinalResult(student);
            return {
                student,
                completion,
                overallPercentage: finalResult.overallPercentage,
                overallGrade: finalResult.overallGrade
            };
        });

        res.render('admin/marks', {
            title: 'Marks Overview',
            classes,
            selectedClassId,
            resultRows
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading marks overview');
        res.redirect('/admin/dashboard');
    }
});

// ========================
// CLASS-WISE PAYMENT COLLECTION
// ========================

// View class payment collection form
router.get('/classes/:id/fees/collect-payment', async (req, res) => {
    try {
        const classDoc = await Class.findById(req.params.id).populate('students');
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/admin/classes/fees');
        }

        const classFee = await ClassFee.findOne({ classId: req.params.id });
        const students = await Student.find({ classId: req.params.id }).populate('userId');

        res.render('admin/classes/collect-payment', {
            title: `Collect Payment - ${classDoc.name}`,
            classDoc,
            classFee,
            students,
            monthOptions: getMonthOptions({ monthsBack: 12, monthsForward: 12 }),
            suggestedAmount: resolveStandardMonthlyFee(null, classFee)
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading payment form');
        res.redirect('/admin/classes/fees');
    }
});

// Collect class-wise payment and distribute to all students
router.post('/classes/:id/fees/collect-payment', async (req, res) => {
    try {
        const { amountPerStudent, month, isOverdue } = req.body;
        // Support both 'selectedStudents' and 'selectedStudents[]' naming
        let selectedStudents = req.body.selectedStudents || req.body['selectedStudents[]'];

        // Get class
        const classDoc = await Class.findById(req.params.id);
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/admin/classes/fees');
        }

        const classFee = await ClassFee.findOne({ classId: req.params.id });
        const standardMonthlyFee = resolveStandardMonthlyFee(null, classFee, amountPerStudent);

        // Ensure selectedStudents is array
        const studentIds = Array.isArray(selectedStudents)
            ? selectedStudents.filter(Boolean)
            : [selectedStudents].filter(Boolean);

        if (!studentIds || studentIds.length === 0) {
            req.flash('error_msg', 'Please select at least one student');
            return res.redirect(`/admin/classes/${req.params.id}/fees/collect-payment`);
        }

        if (!month) {
            req.flash('error_msg', 'Please choose a fee month');
            return res.redirect(`/admin/classes/${req.params.id}/fees/collect-payment`);
        }

        const createDueOnly = Boolean(isOverdue);
        const amount = toAmount(amountPerStudent);

        if (!(createDueOnly ? standardMonthlyFee : amount)) {
            req.flash('error_msg', createDueOnly ? 'Set a valid due amount before creating dues' : 'Please enter a valid amount per student');
            return res.redirect(`/admin/classes/${req.params.id}/fees/collect-payment`);
        }

        const updatedStudents = [];

        // Process only selected students
        for (const studentId of studentIds) {
            const student = await Student.findById(studentId).populate('userId');
            if (!student) continue;

            let fee = await Fee.findOne({ studentId });
            if (!fee) {
                fee = await Fee.create({ studentId });
            }

            if ((!fee.totalDue || fee.totalDue === 0) && standardMonthlyFee > 0) {
                fee.totalDue = standardMonthlyFee;
            }
            if ((!fee.monthlyFee || fee.monthlyFee === 0) && standardMonthlyFee > 0) {
                fee.monthlyFee = standardMonthlyFee;
            }

            if (createDueOnly) {
                const monthlyDue = ensureMonthlyDue(fee, {
                    month,
                    dueAmount: standardMonthlyFee,
                    dueDate: getDefaultDueDate(month)
                });
                monthlyDue.dueAmount = standardMonthlyFee;
                monthlyDue.dueDate = monthlyDue.dueDate || getDefaultDueDate(month);
                normaliseDue(monthlyDue);
            } else {
                applyPaymentRecord(fee, {
                    amount,
                    month,
                    description: `Class fee collection for ${month}`,
                    collectedFromClass: true,
                    classId: req.params.id,
                    standardMonthlyFee
                });
            }

            await fee.save();
            updatedStudents.push({
                studentId,
                studentName: student.userId.name,
                amount: createDueOnly ? standardMonthlyFee : amount,
                month
            });
        }

        if (createDueOnly) {
            req.flash('success_msg', `Monthly due created for ${updatedStudents.length} students in ${classDoc.name} for ${month}.`);
        } else {
            req.flash('success_msg', `Payment collected from ${updatedStudents.length} students in ${classDoc.name} for ${month}.`);
        }

        res.redirect(`/admin/classes/${req.params.id}/fees/payment-history`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error collecting payment');
        res.redirect(`/admin/classes/${req.params.id}/fees/collect-payment`);
    }
});

// View class payment collection history
router.get('/classes/:id/fees/payment-history', async (req, res) => {
    try {
        const classDoc = await Class.findById(req.params.id);
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/admin/classes/fees');
        }

        const students = await Student.find({ classId: req.params.id }).populate('userId');
        const classFee = await ClassFee.findOne({ classId: req.params.id });
        const standardMonthlyFee = resolveStandardMonthlyFee(null, classFee);
        
        // Get all payments for students in this class
        const classFees = await Fee.find({
            studentId: { $in: students.map(s => s._id) }
        }).populate('studentId');

        // Group payments by student and extract class payments
        const paymentHistory = students.map(student => {
            const fee = classFees.find(f => f.studentId._id.toString() === student._id.toString());
            const classPayments = fee ? sortPaymentsByDateDesc(fee.payments.filter(p => p.collectedFromClass)) : [];
            const summary = buildFeeSummary(fee || { payments: [], monthlyDues: [] }, { standardMonthlyFee });
            return {
                student,
                fee,
                classPayments,
                dueEntries: fee ? buildDueEntries(fee.monthlyDues, new Date()) : [],
                summary,
                totalCollected: toAmount(classPayments.reduce((sum, p) => sum + p.amount, 0))
            };
        });

        res.render('admin/classes/payment-history', {
            title: `Payment History - ${classDoc.name}`,
            classDoc,
            classFee,
            standardMonthlyFee,
            paymentHistory
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading payment history');
        res.redirect('/admin/classes/fees');
    }
});

module.exports = router;
