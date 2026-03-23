const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const Notice = require('../models/Notice');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

// Home page
router.get('/', async (req, res) => {
    try {
        // Get latest blog posts
        const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('author', 'name');

        // Get latest notices
        const notices = await Notice.find()
            .sort({ date: -1 })
            .limit(5);

        // School statistics
        const stats = {
            students: 1200,
            teachers: 85,
            classes: 45,
            activities: 25
        };

        // Testimonials
        const testimonials = [
            {
                name: "Sarah Johnson",
                role: "Parent",
                quote: "The school has provided an excellent learning environment for my child.",
                image: "/img/testimonial1.jpg"
            },
            {
                name: "Michael Chen",
                role: "Student",
                quote: "I love the interactive learning methods and supportive teachers.",
                image: "/img/testimonial2.jpg"
            },
            {
                name: "Dr. Emily Brown",
                role: "Teacher",
                quote: "A great place to work with excellent resources and supportive staff.",
                image: "/img/testimonial3.jpg"
            }
        ];

        // Featured events
        const events = [
            {
                title: "Annual Sports Day",
                date: new Date('2025-12-15'),
                description: "Join us for our annual sports day celebration.",
                image: "/img/event1.jpg"
            },
            {
                title: "Science Fair 2025",
                date: new Date('2025-11-25'),
                description: "Showcasing innovative projects by our talented students.",
                image: "/img/event2.jpg"
            },
            {
                title: "Cultural Festival",
                date: new Date('2025-12-05'),
                description: "Celebrating diversity through art, music, and dance.",
                image: "/img/event3.jpg"
            }
        ];

        res.render('index', {
            title: 'MySchool Portal',
            blogs,
            notices,
            stats,
            testimonials,
            events
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us' });
});

// Admissions page
router.get('/admissions', (req, res) => {
    res.render('admissions', { title: 'Admissions' });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
});

// Handle contact form submission
router.post('/contact', async (req, res) => {
    try {
        // Here you would typically save the contact form data to MongoDB
        // and possibly send an email notification
        
        req.flash('success_msg', 'Your message has been sent successfully');
        res.redirect('/contact');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error sending message');
        res.redirect('/contact');
    }
});

// Profile page for logged in user
router.get('/profile', async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash('error_msg', 'Please login to view your profile');
            return res.redirect('/auth/login');
        }

        const user = await User.findById(req.session.user.id).lean();
        let roleData = null;

        if (user.role === 'student') {
            roleData = await Student.findOne({ userId: user._id }).populate('classId').lean();
        } else if (user.role === 'teacher') {
            roleData = await Teacher.findOne({ userId: user._id }).populate('classIds').lean();
        }

        res.render('profile', {
            title: 'My Profile',
            user,
            roleData
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

module.exports = router;
