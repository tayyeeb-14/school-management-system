// scripts/cleanup-sample-data.js
// Deletes all sample/demo academic data while preserving admin account
// SAFETY: Includes environment checks to prevent accidental runs on production

(async () => {
  try {
    require('dotenv').config();

    // Environment guard: prevent accidental runs against production
    const argv = process.argv.slice(2);
    const force = argv.includes('--force');
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const mongoUri = (process.env.MONGO_URI || '').toLowerCase();

    function looksLikeProduction(uri) {
      if (!uri) return false;
      const checks = ['prod', 'production', 'atlas', 'live'];
      return checks.some((s) => uri.includes(s));
    }

    if (!force && (nodeEnv === 'production' || looksLikeProduction(mongoUri))) {
      console.error('❌ Cleanup blocked: Do not run against production environment.');
      console.error('   Use --force flag to override (NOT RECOMMENDED)');
      process.exit(1);
    }

    if (force) {
      console.warn('⚠️  WARNING: Running with --force override. Ensure this is NOT production!');
    }

    const mongoose = require('mongoose');
    const connectDB = require('../config/database');
    
    await connectDB();
    console.log('✓ Connected to database');

    // Import all models
    const User = require('../models/User');
    const Student = require('../models/Student');
    const Teacher = require('../models/Teacher');
    const Class = require('../models/Class');
    const Subject = require('../models/Subject');
    const TimetableSlot = require('../models/Timetable');
    const Attendance = require('../models/Attendance');
    const Salary = require('../models/Salary');
    const TeacherShift = require('../models/TeacherShift');
    const Blog = require('../models/Blog');
    const Notice = require('../models/Notice');
    const Assignment = require('../models/Assignment');
    const Fee = require('../models/Fee');
    const ClassFee = require('../models/ClassFee');

    // Track deletions
    const stats = {
      studentUsers: 0,
      teacherUsers: 0,
      studentRecords: 0,
      teacherRecords: 0,
      classes: 0,
      subjects: 0,
      timetables: 0,
      attendance: 0,
      salary: 0,
      teacherShifts: 0,
      blogs: 0,
      notices: 0,
      assignments: 0,
      fees: 0,
      classFees: 0
    };

    console.log('\n📋 Starting cleanup of sample academic data...\n');

    // 1. Delete all student users and their data
    console.log('Deleting student data...');
    const studentUsers = await User.find({ role: 'student' });
    const studentUserIds = studentUsers.map(u => u._id);
    
    if (studentUsers.length > 0) {
      stats.studentUsers = studentUsers.length;
      await Student.deleteMany({ userId: { $in: studentUserIds } });
      stats.studentRecords = studentUsers.length;
      await User.deleteMany({ role: 'student' });
      console.log(`  ✓ Deleted ${studentUsers.length} student user(s) and records`);
    }

    // 2. Delete all teacher users and their data
    console.log('Deleting teacher data...');
    const teacherUsers = await User.find({ role: 'teacher' });
    const teacherUserIds = teacherUsers.map(u => u._id);
    
    if (teacherUsers.length > 0) {
      stats.teacherUsers = teacherUsers.length;
      
      // Get teacher records before deleting users
      const teachers = await Teacher.find({ userId: { $in: teacherUserIds } });
      const teacherIds = teachers.map(t => t._id);
      stats.teacherRecords = teachers.length;
      
      // Delete related data for teachers
      if (teacherIds.length > 0) {
        await TeacherShift.deleteMany({ teacherId: { $in: teacherIds } });
        await Salary.deleteMany({ teacherId: { $in: teacherIds } });
        await Attendance.deleteMany({ markedBy: { $in: teacherIds } });
      }
      
      // Delete teacher records and users
      await Teacher.deleteMany({ userId: { $in: teacherUserIds } });
      await User.deleteMany({ role: 'teacher' });
      console.log(`  ✓ Deleted ${teacherUsers.length} teacher user(s), ${teacherIds.length} teacher record(s), and related shifts/salaries`);
    }

    // 3. Delete all classes
    console.log('Deleting classes...');
    const classCount = await Class.countDocuments();
    if (classCount > 0) {
      stats.classes = classCount;
      
      // Get class IDs before deleting
      const classes = await Class.find();
      const classIds = classes.map(c => c._id);
      
      // Delete related data
      if (classIds.length > 0) {
        await TimetableSlot.deleteMany({ classId: { $in: classIds } });
        stats.timetables = await TimetableSlot.countDocuments({ classId: { $in: classIds } });
        await Attendance.deleteMany({ classId: { $in: classIds } });
        await Assignment.deleteMany({ classId: { $in: classIds } });
        await ClassFee.deleteMany({ classId: { $in: classIds } });
      }
      
      await Class.deleteMany();
      console.log(`  ✓ Deleted ${classCount} class(es) and related timetables/assignments`);
    }

    // 4. Delete all subjects
    console.log('Deleting subjects...');
    const subjectCount = await Subject.countDocuments();
    if (subjectCount > 0) {
      stats.subjects = subjectCount;
      await Subject.deleteMany();
      console.log(`  ✓ Deleted ${subjectCount} subject(s)`);
    }

    // 5. Delete remaining attendance records (any not caught by class deletion)
    console.log('Deleting remaining attendance records...');
    const attendanceCount = await Attendance.countDocuments();
    if (attendanceCount > 0) {
      stats.attendance = attendanceCount;
      await Attendance.deleteMany();
      console.log(`  ✓ Deleted ${attendanceCount} attendance record(s)`);
    }

    // 6. Delete remaining salary records (any not caught by teacher deletion)
    console.log('Deleting remaining salary records...');
    const salaryCount = await Salary.countDocuments();
    if (salaryCount > 0) {
      stats.salary = salaryCount;
      await Salary.deleteMany();
      console.log(`  ✓ Deleted ${salaryCount} salary record(s)`);
    }

    // 7. Delete remaining teacher shifts (any not caught by teacher deletion)
    console.log('Deleting remaining teacher shifts...');
    const shiftCount = await TeacherShift.countDocuments();
    if (shiftCount > 0) {
      stats.teacherShifts = shiftCount;
      await TeacherShift.deleteMany();
      console.log(`  ✓ Deleted ${shiftCount} teacher shift record(s)`);
    }

    // 8. Delete blogs (sample only - delete all since system just started)
    console.log('Deleting blogs...');
    const blogCount = await Blog.countDocuments();
    if (blogCount > 0) {
      stats.blogs = blogCount;
      await Blog.deleteMany();
      console.log(`  ✓ Deleted ${blogCount} blog(s)`);
    }

    // 9. Delete notices (sample only - delete all since system just started)
    console.log('Deleting notices...');
    const noticeCount = await Notice.countDocuments();
    if (noticeCount > 0) {
      stats.notices = noticeCount;
      await Notice.deleteMany();
      console.log(`  ✓ Deleted ${noticeCount} notice(s)`);
    }

    // 10. Delete assignments
    console.log('Deleting assignments...');
    const assignmentCount = await Assignment.countDocuments();
    if (assignmentCount > 0) {
      stats.assignments = assignmentCount;
      await Assignment.deleteMany();
      console.log(`  ✓ Deleted ${assignmentCount} assignment(s)`);
    }

    // 11. Delete fees
    console.log('Deleting fees...');
    const feeCount = await Fee.countDocuments();
    if (feeCount > 0) {
      stats.fees = feeCount;
      await Fee.deleteMany();
      console.log(`  ✓ Deleted ${feeCount} fee record(s)`);
    }

    // 12. Delete class fees
    console.log('Deleting class fees...');
    const classFeeCount = await ClassFee.countDocuments();
    if (classFeeCount > 0) {
      stats.classFees = classFeeCount;
      await ClassFee.deleteMany();
      console.log(`  ✓ Deleted ${classFeeCount} class fee record(s)`);
    }

    // Verify admin account still exists
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('\n❌ ERROR: Admin account was deleted! This should not happen.');
      process.exit(1);
    }

    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n📊 Summary of deletions:');
    console.log(`  • Student user accounts: ${stats.studentUsers}`);
    console.log(`  • Student records: ${stats.studentRecords}`);
    console.log(`  • Teacher user accounts: ${stats.teacherUsers}`);
    console.log(`  • Teacher records: ${stats.teacherRecords}`);
    console.log(`  • Classes: ${stats.classes}`);
    console.log(`  • Subjects: ${stats.subjects}`);
    console.log(`  • Timetables: ${stats.timetables}`);
    console.log(`  • Attendance records: ${stats.attendance}`);
    console.log(`  • Salary records: ${stats.salary}`);
    console.log(`  • Teacher shifts: ${stats.teacherShifts}`);
    console.log(`  • Blogs: ${stats.blogs}`);
    console.log(`  • Notices: ${stats.notices}`);
    console.log(`  • Assignments: ${stats.assignments}`);
    console.log(`  • Fees: ${stats.fees}`);
    console.log(`  • Class fees: ${stats.classFees}`);
    console.log(`\n✓ Admin account preserved: ${admin.username}`);
    console.log('✓ Authentication, routes, models, views, and UI remain intact');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Cleanup failed:', err && err.message ? err.message : err);
    console.error(err);
    process.exit(1);
  }
})();
