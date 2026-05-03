const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const upload = require('../config/multer');
const bcrypt = require('bcryptjs');
const { sendOtpEmail } = require('../utils/email');

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { title: 'Login' });
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', { title: 'Register' });
});

// Handle login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            req.flash('error_msg', 'Please provide both username and password');
            return res.redirect('/auth/login');
        }

        const user = await User.findOne({ username });
        if (!user) {
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/auth/login');
        }

        // Save relevant user info in session; include photo so layouts can display profile image
        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            photo: user.photo
        };

        // Redirect based on role
        switch (user.role) {
            case 'admin':
                res.redirect('/admin/dashboard');
                break;
            case 'teacher':
                res.redirect('/teacher/dashboard');
                break;
            case 'student':
                res.redirect('/student/dashboard');
                break;
            default:
                res.redirect('/');
        }
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error_msg', error.message || 'Error during login');
        res.redirect('/auth/login');
    }
});

// Handle student registration
// Use multer to handle profile photo upload from the registration form
router.post('/register/student', upload.single('photo'), async (req, res) => {
    try {
        const { username, password, name, email, phone, class: className, fatherName } = req.body;

        // Check if username already exists globally
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            req.flash('error_msg', 'Username already exists');
            return res.redirect('/auth/register');
        }

        // Create user
        const user = await User.create({
            username,
            password,
            name,
            email,
            phone,
            photo: req.file ? req.file.filename : undefined,
            role: 'student'
        });

        // Find or create class
        let classDoc = await Class.findOne({ name: className });
        if (!classDoc) {
            classDoc = await Class.create({ name: className });
        }

        // Create student profile
        const student = await Student.create({
            userId: user._id,
            classId: classDoc._id,
            status: 'pending',
            subjects: [],
            fatherName
        });

        // Add student to class
        classDoc.students.push(student._id);
        await classDoc.save();

        req.flash('success_msg', 'Registration successful. Please login');
        res.redirect('/auth/login');
    } catch (error) {
        console.error(error);
        // Show the error message to help debugging (will still be visible only in UI/flash)
        req.flash('error_msg', error.message || 'Error during registration');
        res.redirect('/auth/register');
    }
});

// Handle teacher registration (admin only)
router.post('/register/teacher', async (req, res) => {
    try {
        const { username, password, name, email, phone, subject, qualifications } = req.body;

        // Create user
        const user = await User.create({
            username,
            password,
            name,
            email,
            phone,
            role: 'teacher'
        });

        // Create teacher profile
        await Teacher.create({
            userId: user._id,
            subject,
            qualifications
        });

        req.flash('success_msg', 'Teacher registration successful');
        res.redirect('/admin/teachers');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error during teacher registration');
        res.redirect('/admin/teachers/new');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Reset password page
router.get('/reset-password', async (req, res) => {
    try {
        const resetMode = !!(req.session && req.session.resetUser);
        let resetUser = null;
        if (resetMode) {
            // provide username to view if available
            const User = require('../models/User');
            resetUser = await User.findById(req.session.resetUser).lean();
        }
        res.render('auth/reset-password', { title: 'Reset Password', resetMode, resetUser });
    } catch (err) {
        console.error('Error loading reset-password view:', err);
        res.render('auth/reset-password', { title: 'Reset Password', resetMode: false });
    }
});

// ============================================
// NEW SINGLE-PAGE PASSWORD RESET FLOW (AJAX)
// ============================================

// Get the forgot-reset page
router.get('/forgot-reset', (req, res) => {
    res.render('auth/forgot-reset', { title: 'Reset Password' });
});

// POST: Send OTP (returns JSON)
router.post('/forgot-reset/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Security: don't reveal if email exists
            return res.status(200).json({ message: 'OTP sent successfully' });
        }

        const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
        const hashed = await bcrypt.hash(otp, 10);
        user.resetOtp = hashed;
        user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendOtpEmail(user.email, otp);
        // OTP generated (not logged in production)

        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ message: 'Error sending OTP' });
    }
});

// POST: Verify OTP (returns JSON, sets session)
router.post('/forgot-reset/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const user = await User.findOne({ email });
        if (!user || !user.resetOtp || user.resetOtpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP invalid or expired' });
        }

        const ok = await bcrypt.compare(otp, user.resetOtp);
        if (!ok) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Mark session for reset
        req.session.resetUser = user._id;

        res.json({ message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Error verifying OTP' });
    }
});

// POST: Reset Password (returns JSON)
router.post('/forgot-reset/reset-password', async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Get user from session (set by verify-otp)
        if (!req.session || !req.session.resetUser) {
            return res.status(401).json({ message: 'Session expired. Please start over.' });
        }

        const userId = req.session.resetUser;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = newPassword;
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();

        // Clear session
        delete req.session.resetUser;

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;