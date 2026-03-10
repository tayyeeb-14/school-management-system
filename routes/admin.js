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
const upload = require('../config/multer');

// Protect all admin routes
router.use(isLoggedIn, isAdmin);

// Use dashboard layout for admin routes and set path
router.use((req, res, next) => {
    res.locals.layout = 'layouts/dashboard';
    res.locals.path = req.path;  // Add this line to set path for all routes
    next();
});

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
            pendingStudents
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
    console.log('=== POST /admin/students route hit ===');
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
        
        console.log('=== Student Creation Attempt ===');
        console.log('Body:', { username, name, email, className, rollNo, phone: phone ? 'provided' : 'not provided' });
        console.log('File:', req.file ? req.file.filename : 'no file');
        
        // Basic validation
        if (!username || !password || !name || !email || !className || !rollNo) {
            console.log('Validation failed: Missing required fields');
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
            console.log('Duplicate username found:', username);
            req.flash('error_msg', 'Username already exists');
            return res.redirect('/admin/students/new');
        }

        // Check for duplicate roll number within the same class
        const existingRollNo = await Student.findOne({ rollNo, classId: classDoc._id });
        if (existingRollNo) {
            console.log('Duplicate roll number found in same class:', rollNo);
            req.flash('error_msg', 'Roll number already exists in this class');
            return res.redirect('/admin/students/new');
        }

        console.log('Creating user...');
        const user = await User.create({
            username,
            password,
            name,
            email,
            phone: phone || undefined,
            role: 'student',
            photo: req.file ? req.file.filename : 'default.jpg'
        });
        console.log('User created:', user._id);

        try {
            console.log('Creating student profile...');
            const student = await Student.create({
                userId: user._id,
                classId: classDoc._id,
                rollNo,
                fatherName
            });
            console.log('Student profile created successfully');

            // Add student to class
            classDoc.students.push(student._id);
            await classDoc.save();
        } catch (studentError) {
            console.error('Student creation failed, deleting user:', studentError);
            // If student creation fails, delete the user to avoid orphaned records
            await User.findByIdAndDelete(user._id);
            throw studentError;
        }

        console.log('=== Student Created Successfully ===');
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
            .populate('userId', 'name email');
            
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
router.get('/teachers/new', (req, res) => {
    res.render('admin/teachers/new', { title: 'Add New Teacher' });
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
        const { username, password, name, email, subject, qualifications } = req.body;

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

        await Teacher.create({
            userId: user._id,
            subject,
            qualifications
        });

        req.flash('success_msg', 'Teacher added successfully');
        return res.redirect('/admin/teachers');
    } catch (error) {
        console.error(error);
        // Show specific error to help debugging (will appear in UI flash)
        req.flash('error_msg', error.message || 'Error adding teacher');
        return res.redirect('/admin/teachers/new');
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

        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        // Auto-calculate totalDue from class fees if not set
        if ((!fee.totalDue || fee.totalDue === 0) && student.classId) {
            const classFee = await ClassFee.findOne({ classId: student.classId._id });
            if (classFee && classFee.totalMonthlyFee) {
                fee.totalDue = classFee.totalMonthlyFee;
                await fee.save();
            }
        }

        // Calculate totals
        const totalPaid = fee.payments ? fee.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const balance = (fee.totalDue || 0) - totalPaid;

        res.render('admin/students/fees', {
            title: 'Student Fee Management',
            student,
            fee,
            totalPaid,
            balance
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

        fee.monthlyFee = monthlyFee || 0;
        fee.totalDue = totalDue || 0;
        await fee.save();

        req.flash('success_msg', 'Fee details updated successfully');
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
        
        const student = await Student.findById(req.params.id).populate('classId');
        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        // Add payment with timestamp
        const newPayment = {
            amount: parseFloat(amount),
            month,
            description,
            date: new Date(),
            collectedFromClass: false
        };
        fee.payments.push(newPayment);

        // Ensure totalDue is set - try to get from class fees first
        if ((!fee.totalDue || fee.totalDue === 0) && student && student.classId) {
            const classFee = await ClassFee.findOne({ classId: student.classId._id });
            if (classFee && classFee.totalMonthlyFee) {
                fee.totalDue = classFee.totalMonthlyFee;
            }
        }

        // Mark monthly due as paid if selected
        if (monthlyDueId) {
            const monthlyDue = fee.monthlyDues.id(monthlyDueId);
            if (monthlyDue) {
                monthlyDue.isPaid = true;
                monthlyDue.paidAmount = parseFloat(amount);
                monthlyDue.paymentDate = new Date();
            }
        }

        await fee.save();

        // Store payment details in session for invoice generation
        req.session.lastPaymentIndex = fee.payments.length - 1;
        req.session.studentId = req.params.id;
        
        req.flash('success_msg', 'Payment recorded successfully! Invoice generated.');
        res.redirect(`/admin/students/${req.params.id}/fees/invoice`);
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

        const lastPayment = fee.payments[fee.payments.length - 1];
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
        
        let fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            fee = await Fee.create({ studentId: req.params.id });
        }

        fee.monthlyDues.push({
            month,
            dueAmount: parseFloat(dueAmount),
            dueDate: new Date(dueDate),
            isPaid: false,
            paidAmount: 0
        });
        
        await fee.save();

        req.flash('success_msg', 'Monthly due added successfully');
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

        fee.monthlyDues.id(req.params.dueId).remove();
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
        const fee = await Fee.findOne({ studentId: req.params.id });
        if (!fee) {
            req.flash('error_msg', 'Fee record not found');
            return res.redirect(`/admin/students/${req.params.id}/fees`);
        }

        fee.payments.id(req.params.paymentId).remove();
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

        classFee.fees.id(req.params.feeId).remove();
        
        // Update total monthly fee
        classFee.totalMonthlyFee = classFee.fees
            .filter(f => f.frequency === 'monthly')
            .reduce((sum, f) => sum + f.amount, 0);
        
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
            students
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
        const { amountPerStudent, month, isOverdue, selectedStudents } = req.body;
        
        // Get class
        const classDoc = await Class.findById(req.params.id);
        if (!classDoc) {
            req.flash('error_msg', 'Class not found');
            return res.redirect('/admin/classes/fees');
        }

        // Ensure selectedStudents is array
        const studentIds = Array.isArray(selectedStudents) ? selectedStudents : [selectedStudents];
        
        if (!studentIds || studentIds.length === 0) {
            req.flash('error_msg', 'Please select at least one student');
            return res.redirect(`/admin/classes/${req.params.id}/fees/collect-payment`);
        }

        const amount = parseFloat(amountPerStudent);
        const updatedStudents = [];
        
        // Process only selected students
        for (const studentId of studentIds) {
            const student = await Student.findById(studentId).populate('userId');
            if (!student) continue;

            let fee = await Fee.findOne({ studentId });
            if (!fee) {
                fee = await Fee.create({ studentId });
            }

            // Add payment
            const payment = {
                amount,
                month,
                description: month,
                date: new Date(),
                collectedFromClass: true,
                classId: req.params.id
            };
            fee.payments.push(payment);

            // If marked as overdue, create monthlyDue record
            if (isOverdue) {
                const existingDue = fee.monthlyDues.find(d => d.month === month);
                if (!existingDue) {
                    fee.monthlyDues.push({
                        month,
                        dueAmount: amount,
                        dueDate: new Date(),
                        isPaid: false,
                        paidAmount: 0
                    });
                } else {
                    // Update existing due
                    existingDue.isPaid = false;
                    existingDue.paidAmount = 0;
                }
            }

            // Update total due if not set
            if (!fee.totalDue || fee.totalDue === 0) {
                const classFee = await ClassFee.findOne({ classId: req.params.id });
                if (classFee) {
                    fee.totalDue = classFee.totalMonthlyFee;
                }
            }

            await fee.save();
            updatedStudents.push({
                studentId,
                studentName: student.userId.name,
                amount,
                month,
                paymentId: payment._id
            });
        }

        req.flash('success_msg', `Payment collected from ${updatedStudents.length} students in ${classDoc.name} for ${month}. Invoices generated.`);
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
        
        // Get all payments for students in this class
        const classFees = await Fee.find({
            studentId: { $in: students.map(s => s._id) }
        }).populate('studentId');

        // Group payments by student and extract class payments
        const paymentHistory = students.map(student => {
            const fee = classFees.find(f => f.studentId._id.toString() === student._id.toString());
            const classPayments = fee ? fee.payments.filter(p => p.collectedFromClass) : [];
            return {
                student,
                fee,
                classPayments,
                totalCollected: classPayments.reduce((sum, p) => sum + p.amount, 0)
            };
        });

        res.render('admin/classes/payment-history', {
            title: `Payment History - ${classDoc.name}`,
            classDoc,
            paymentHistory
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading payment history');
        res.redirect('/admin/classes/fees');
    }
});

module.exports = router;