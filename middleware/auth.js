module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.session.user) {
            return next();
        }
        req.flash('error_msg', 'Please log in to access this resource');
        res.redirect('/auth/login');
    },

    isAdmin: (req, res, next) => {
        if (req.session.user && req.session.user.role === 'admin') {
            return next();
        }
        req.flash('error_msg', 'Access denied. Admin only.');
        res.redirect('/');
    },

    isTeacher: (req, res, next) => {
        if (req.session.user && req.session.user.role === 'teacher') {
            return next();
        }
        req.flash('error_msg', 'Access denied. Teacher only.');
        res.redirect('/');
    },

    isStudent: async (req, res, next) => {
        if (req.session.user && req.session.user.role === 'student') {
            // Check if student is approved
            const Student = require('../models/Student');
            const student = await Student.findOne({ userId: req.session.user.id });
            if (student && student.status === 'approved') {
                return next();
            }
            req.flash('error_msg', 'Your account is pending approval. Please wait for admin approval.');
            return res.redirect('/');
        }
        req.flash('error_msg', 'Access denied. Student only.');
        res.redirect('/');
    }
};