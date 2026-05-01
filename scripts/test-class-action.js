const connectDB = require('../config/database');
const mongoose = require('mongoose');
const Class = require('../models/Class');
const User = require('../models/User');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const ClassFee = require('../models/ClassFee');
const { toAmount, ensureMonthlyDue, applyPaymentRecord, getDefaultDueDate, normaliseDue, rebuildDueLedger, formatMonthLabel } = require('../utils/fee');

async function run() {
  await connectDB();
  try {
    const classDoc = await Class.findOne().populate('students');
    if (!classDoc) {
      console.log('No class found');
      return;
    }
    console.log('Using class:', classDoc.name, 'students:', (classDoc.students || []).length);

    const classFee = await ClassFee.findOne({ classId: classDoc._id });
    const students = await Student.find({ classId: classDoc._id }).populate('userId');
    if (!students || students.length === 0) {
      console.log('No students in class');
      return;
    }

    const month = formatMonthLabel(new Date());
    const amountPerStudent = toAmount(classFee?.calculatedMonthlyFee || classFee?.totalMonthlyFee || 0) || 100; // fallback
    console.log('Month:', month, 'AmountPerStudent:', amountPerStudent);

    const updated = [];
    for (const student of students) {
      let fee = await Fee.findOne({ studentId: student._id });
      if (!fee) fee = await Fee.create({ studentId: student._id });

      // set defaults if missing
      if ((!fee.totalDue || fee.totalDue === 0) && amountPerStudent > 0) fee.totalDue = amountPerStudent;
      if ((!fee.monthlyFee || fee.monthlyFee === 0) && amountPerStudent > 0) fee.monthlyFee = amountPerStudent;

      // Apply payment record
      const { payment, due, allocation } = applyPaymentRecord(fee, {
        amount: amountPerStudent,
        month,
        description: `Test class payment ${month}`,
        collectedFromClass: true,
        classId: classDoc._id,
        standardMonthlyFee: amountPerStudent
      });

      await fee.save();

      updated.push({ student: student.userId.name, paymentId: payment._id, applied: allocation.appliedAmount, remaining: allocation.remainingAmount, dueId: due._id });
    }

    console.log('Updated students:', updated);

    // Print sample Fee doc for first student
    const firstStudent = students[0];
    const feeDoc = await Fee.findOne({ studentId: firstStudent._id }).lean();
    console.log('Sample fee doc for', firstStudent.userId.name, JSON.stringify({ payments: feeDoc.payments, monthlyDues: feeDoc.monthlyDues }, null, 2));
  } catch (e) {
    console.error('Error', e);
  } finally {
    mongoose.disconnect();
  }
}

run();
