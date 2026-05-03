// E2E sample-delete.js
// TEST ONLY: This script creates sample data and deletes it via admin routes.
// Do NOT include or run in production environments. Keep under `/scripts` for local testing.

(async()=>{
  try {
    require('dotenv').config();

    // Environment guard: prevent accidental runs against production.
    // Conditions that block execution unless overridden with `--force`:
    //  - NODE_ENV === 'production'
    //  - MONGO_URI contains production indicators such as 'prod', 'production', or 'atlas'
    const argv = process.argv.slice(2);
    const force = argv.includes('--force');

    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const mongoUri = (process.env.MONGO_URI || process.env.MONGO_URI || '').toLowerCase();

    function looksLikeProduction(uri) {
      if (!uri) return false;
      const checks = ['prod', 'production', 'atlas', 'live'];
      return checks.some((s) => uri.includes(s));
    }

    if (!force && (nodeEnv === 'production' || looksLikeProduction(mongoUri))) {
      console.error('E2E test blocked: Do not run against production environment.');
      process.exit(1);
    }

    if (force) {
      console.warn('E2E test override: --force supplied. Proceeding despite environment checks.');
    }

    const connect = require('../config/database');
    await connect();
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const Teacher = require('../models/Teacher');
    const Blog = require('../models/Blog');
    const Notice = require('../models/Notice');

    console.log('Creating sample records...');

    // Remove any pre-existing e2e sample teacher to avoid duplicates
    const existingUser = await User.findOne({ username: 'e2e_teacher' });
    if (existingUser) {
      await Teacher.findOneAndDelete({ userId: existingUser._id });
      await User.findByIdAndDelete(existingUser._id);
    }

    // Create teacher user + teacher profile
    const teacherUser = await User.create({
      username: 'e2e_teacher',
      password: 'password',
      name: 'E2E Teacher',
      email: 'e2e_teacher@example.com',
      role: 'teacher'
    });

    const teacher = await Teacher.create({ userId: teacherUser._id, subject: 'Math', qualifications: 'MSc' });

    // Find admin to use as blog author
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) throw new Error('No admin user found for blog author');

    const blog = await Blog.create({
      title: 'E2E Test Blog',
      content: 'Sample content',
      category: 'Test',
      author: admin._id
    });

    const notice = await Notice.create({ title: 'E2E Notice', content: 'Notice content', createdBy: admin._id });

    console.log('Created:', { teacherId: teacher._id.toString(), blogId: blog._id.toString(), noticeId: notice._id.toString() });

    // Now perform HTTP requests as admin to delete via routes
    const http = require('http');
    function reqp(options, body) {
      return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve({ res, body: d }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    }

    // Login as admin
    const loginBody = 'username=admin&password=admin';
    const login = await reqp({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginBody) } }, loginBody);
    if (login.res.statusCode !== 302) throw new Error('Admin login failed');
    const cookie = (login.res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    // Delete teacher
    const delTeacher = await reqp({ hostname: 'localhost', port: 3000, path: '/admin/teachers/' + teacher._id.toString(), method: 'DELETE', headers: { Cookie: cookie } }, null);
    console.log('Delete teacher status', delTeacher.res.statusCode);

    // Delete blog
    const delBlog = await reqp({ hostname: 'localhost', port: 3000, path: '/admin/blogs/' + blog._id.toString(), method: 'DELETE', headers: { Cookie: cookie } }, null);
    console.log('Delete blog status', delBlog.res.statusCode);

    // Delete notice
    const delNotice = await reqp({ hostname: 'localhost', port: 3000, path: '/admin/notices/' + notice._id.toString(), method: 'DELETE', headers: { Cookie: cookie } }, null);
    console.log('Delete notice status', delNotice.res.statusCode);

    // Verify DB removals
    const foundTeacher = await Teacher.findById(teacher._id);
    const foundTeacherUser = await User.findById(teacherUser._id);
    const foundBlog = await Blog.findById(blog._id);
    const foundNotice = await Notice.findById(notice._id);

    console.log('Post-delete DB check:', {
      teacherExists: !!foundTeacher,
      teacherUserExists: !!foundTeacherUser,
      blogExists: !!foundBlog,
      noticeExists: !!foundNotice
    });

    // Cleanup leftover user if teacher deletion didn't remove user
    if (foundTeacherUser) {
      await User.findByIdAndDelete(foundTeacherUser._id);
      console.log('Cleaned up teacher user fallback');
    }

    console.log('E2E sample delete test completed');
    process.exit(0);
  } catch (err) {
    console.error('E2E sample-delete failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
