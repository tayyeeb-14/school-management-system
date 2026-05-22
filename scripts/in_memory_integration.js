/* In-memory integration test for teacher-shift, attendance, and marks logic.

Run steps (after installing mongodb-memory-server):

npm install --save-dev mongodb-memory-server
node scripts/in_memory_integration.js

This script starts an in-memory MongoDB, connects Mongoose, seeds data, runs checks, and prints results.
*/

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');
const TeacherShift = require('../models/TeacherShift');
const Attendance = require('../models/Attendance');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('Started in-memory mongo at', uri);

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Seed data
  const adminUser = await User.create({ username: 'admin1', password: 'pass123', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  const teacherUser = await User.create({ username: 't1', password: 'pass123', role: 'teacher', name: 'Teach One', email: 't1@example.com' });
  const otherTeacherUser = await User.create({ username: 't2', password: 'pass123', role: 'teacher', name: 'Teach Two', email: 't2@example.com' });
  const studentUser = await User.create({ username: 's1', password: 'pass123', role: 'student', name: 'Student One', email: 's1@example.com' });

  const classDoc = await Class.create({ name: 'Class A', subjects: ['Math','English','Science'] });

  const teacher = await Teacher.create({ userId: teacherUser._id, subjects: ['Math','Science'], classIds: [classDoc._id] });
  const otherTeacher = await Teacher.create({ userId: otherTeacherUser._id, subjects: ['English'], classIds: [] });

  // Assign class teacher (class.teacherId references Teacher)
  classDoc.teacherId = teacher._id;
  await classDoc.save();

  const student = await Student.create({ userId: studentUser._id, classId: classDoc._id, status: 'approved' });

  // 1) Teacher check-in
  const now = new Date();
  const dateKey = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let shift = await TeacherShift.findOneAndUpdate(
    { teacherId: teacher._id, date: dateKey },
    { $setOnInsert: { teacherId: teacher._id, date: dateKey, checkInAt: now, checkInLat: 12.34, checkInLng: 56.78, checkInLocation: 'lat:12.34,lng:56.78' } },
    { upsert: true, new: true }
  );

  console.log('Check-in shift created:', !!shift._id);

  // Simulate check-out
  const later = new Date(now.getTime() + 90 * 60000); // 90 minutes later
  shift.checkOutAt = later;
  shift.checkOutLat = 12.341;
  shift.checkOutLng = 56.781;
  shift.checkOutLocation = 'lat:12.341,lng:56.781';
  shift.durationMinutes = Math.round((shift.checkOutAt - shift.checkInAt)/60000);
  await shift.save();

  const reloaded = await TeacherShift.findById(shift._id);
  console.log('Numeric fields saved:', reloaded.checkInLat === 12.34 && reloaded.checkOutLat === 12.341);
  console.log('Duration minutes:', reloaded.durationMinutes);

  // Admin view: fetch shifts and prepare map link
  const adminShifts = await TeacherShift.find().populate({ path: 'teacherId', populate: { path: 'userId', select: 'name' } });
  const s = adminShifts[0];
  const coords = s.checkOutLat && s.checkOutLng ? { lat: s.checkOutLat, lng: s.checkOutLng } : null;
  console.log('Admin map link available:', !!coords);

  // 2) Attendance: only class teacher can mark
  // Attempt by assigned teacher (should succeed)
  const attendanceEntries = [{ studentId: student._id, status: 'present' }];
  await Attendance.findOneAndUpdate({ classId: classDoc._id, date: dateKey }, { classId: classDoc._id, date: dateKey, markedBy: teacher._id, entries: attendanceEntries }, { upsert: true, new: true });

  // Sync to student.attendance as app logic does
  await Student.findByIdAndUpdate(student._id, { $pull: { attendance: { date: { $gte: dateKey, $lte: new Date(dateKey.getTime()+24*60*60*1000-1) } } } });
  await Student.findByIdAndUpdate(student._id, { $push: { attendance: { date: dateKey, status: 'present' } } });

  const updatedStudent = await Student.findById(student._id);
  console.log('Student attendance length:', updatedStudent.attendance.length, 'percentage:', updatedStudent.attendancePercentage);

  // Attempt attendance by other teacher (should be blocked by route logic) - here we simulate check
  const classDocFresh = await Class.findById(classDoc._id).select('teacherId');
  const allowed = String(classDocFresh.teacherId) === String(otherTeacher._id);
  console.log('Other teacher allowed to mark attendance (should be false):', allowed);

  // 3) Marks: allowed subject
  const allowedSubject = 'Math';
  const forbiddenSubject = 'English';

  const teacherSubjectsLower = (teacher.subjects||[]).map(s=>s.toLowerCase());
  const classSubjectsLower = (classDoc.subjects||[]).map(s=>s.toLowerCase());

  const canEnterAllowed = teacherSubjectsLower.includes(allowedSubject.toLowerCase()) && classSubjectsLower.includes(allowedSubject.toLowerCase());
  const canEnterForbidden = teacherSubjectsLower.includes(forbiddenSubject.toLowerCase()) && classSubjectsLower.includes(forbiddenSubject.toLowerCase());

  console.log('Can enter Math (should be true):', canEnterAllowed);
  console.log('Can enter English (should be false):', canEnterForbidden);

  // Simulate entering marks for Math
  if (canEnterAllowed) {
    updatedStudent.marks.push({ subject: allowedSubject, examType: 'UT1', marks: 42, outOf: 50, date: new Date() });
    if (!updatedStudent.subjects.includes(allowedSubject)) updatedStudent.subjects.push(allowedSubject);
    await updatedStudent.save();
  }

  const afterMarks = await Student.findById(student._id);
  console.log('Marks saved count:', afterMarks.marks.length, 'subjects:', afterMarks.subjects);

  // Ensure no duplicate attendance when marking same day again (upsert should replace)
  await Attendance.findOneAndUpdate({ classId: classDoc._id, date: dateKey }, { classId: classDoc._id, date: dateKey, markedBy: teacher._id, entries: attendanceEntries }, { upsert: true, new: true });
  const attendanceCount = await Attendance.countDocuments({ classId: classDoc._id, date: dateKey });
  console.log('Attendance unique per class-date (should be 1):', attendanceCount);

  // Cleanup and stop
  await mongoose.disconnect();
  await mongod.stop();
  console.log('In-memory integration tests completed successfully');
}

run().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(2);
});
