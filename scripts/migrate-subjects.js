const mongoose = require('mongoose');
require('dotenv').config();
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Subject = require('../models/Subject');

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI missing'); process.exit(1);
  }
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected');

  const set = new Set();
  const classes = await Class.find().lean();
  classes.forEach(c => { (c.subjects||[]).forEach(s => { if (s && String(s).trim()) set.add(String(s).trim()); }); });
  const teachers = await Teacher.find().lean();
  teachers.forEach(t => { (t.subjects||[]).forEach(s => { if (s && String(s).trim()) set.add(String(s).trim()); }); });
  const students = await Student.find().lean();
  students.forEach(s => { (s.subjects||[]).forEach(si => { if (si && String(si).trim()) set.add(String(si).trim()); }); (s.marks||[]).forEach(m=>{ if (m.subject && String(m.subject).trim()) set.add(String(m.subject).trim()); }); });

  const names = Array.from(set).sort();
  console.log('Found subjects:', names);
  let created = 0;
  for (const name of names) {
    const existing = await Subject.findOne({ name });
    if (!existing) {
      await Subject.create({ name }); created++;
    }
  }
  console.log('Created subjects:', created);
  await mongoose.connection.close();
}

run().catch(err => { console.error(err); process.exit(1); });
