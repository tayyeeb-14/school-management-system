const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');

// List all blogs
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'name')
            .populate('comments.user', 'name');

        const totalBlogs = await Blog.countDocuments();
        const totalPages = Math.ceil(totalBlogs / limit);

        res.render('blog/index', {
            title: 'School Blog',
            blogs,
            currentPage: page,
            totalPages,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// Search blogs
router.get('/search', async (req, res) => {
    try {
        const searchQuery = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const query = {
            $or: [
                { title: { $regex: searchQuery, $options: 'i' } },
                { content: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        const blogs = await Blog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'name')
            .populate('comments.user', 'name');

        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);

        res.render('blog/index', {
            title: `Search Results for "${searchQuery}"`,
            blogs,
            currentPage: page,
            totalPages,
            searchQuery,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

// View single blog post
router.get('/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id)
            .populate('author', 'name')
            .populate('comments.user', 'name')
            .populate('likes', 'name');

        if (!blog) {
            req.flash('error_msg', 'Blog post not found');
            return res.redirect('/blog');
        }

        res.render('blog/show', {
            title: blog.title,
            blog,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Server Error' });
    }
});

module.exports = router;