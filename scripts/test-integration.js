// Quick integration checks for:
// - Teacher check-in/check-out numeric coord storage
// - Admin view mapping (we'll print map URL)
// - Subject authorization logic

const mongoose = require('mongoose');
const dbConfig = require('../config/database');
const Teacher = require('../models/Teacher');
const TeacherShift = require('../models/TeacherShift');

async function run() {
  await dbConfig();
  console.log('DB connected');

  const teacher = await Teacher.findOne().populate('userId');
  if (!teacher) {
    console.log('No teacher found in DB — cannot run integration checks');
    process.exit(1);
  }

  console.log('Using teacher:', teacher.userId ? teacher.userId.name : String(teacher._id));

  // Test check-in creation
  const today = new Date();
  const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Cleanup any existing test shift for this teacher/date
  await TeacherShift.deleteOne({ teacherId: teacher._id, date: dateKey });

  const checkInLat = 12.345678;
  const checkInLng = 98.765432;
  const checkInLocation = `lat:${checkInLat},lng:${checkInLng}`;

  const shift = new TeacherShift({
    teacherId: teacher._id,
    date: dateKey,
    checkInAt: new Date(),
    checkInLat,
    checkInLng,
    checkInLocation
  });
  await shift.save();
  console.log('Created shift id', shift._id.toString());

  // Simulate check-out
  shift.checkOutAt = new Date();
  const checkOutLat = 12.346000;
  const checkOutLng = 98.766000;
  shift.checkOutLat = checkOutLat;
  shift.checkOutLng = checkOutLng;
  shift.checkOutLocation = `lat:${checkOutLat},lng:${checkOutLng}`;
  shift.durationMinutes = Math.round((shift.checkOutAt - shift.checkInAt) / 60000);
  await shift.save();

  const reloaded = await TeacherShift.findById(shift._id);
  console.log('Reloaded shift:', {
    checkInLat: reloaded.checkInLat,
    checkInLng: reloaded.checkInLng,
    checkOutLat: reloaded.checkOutLat,
    checkOutLng: reloaded.checkOutLng,
    durationMinutes: reloaded.durationMinutes
  });

  console.log('Admin map link (checkOut):', `https://www.google.com/maps?q=${reloaded.checkOutLat},${reloaded.checkOutLng}`);

  // Subject authorization logic test
  const teacherSubjects = (teacher.subjects || []).map(s => String(s || '').trim().toLowerCase());
  console.log('Teacher subjects:', teacherSubjects);
  const allowed = teacherSubjects.length ? teacherSubjects[0] : null;
  const forbidden = 'SomeRandomSubjectNotAssigned';
  console.log('Allowed subject test:', allowed, '=>', teacherSubjects.includes(String(allowed).toLowerCase()));
  console.log('Forbidden subject test:', forbidden, '=>', teacherSubjects.includes(String(forbidden).toLowerCase()));

  // Cleanup test shift
  await TeacherShift.deleteOne({ _id: shift._id });
  await mongoose.disconnect();
  console.log('Integration checks complete');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
