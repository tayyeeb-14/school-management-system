const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  day: { type: String, required: true }, // Mon, Tue, ...
  period: { type: Number, required: true },
  subject: { type: String, default: '' },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  time: { type: String, default: '' },
  locked: { type: Boolean, default: false }
}, { timestamps: true });

slotSchema.index({ classId: 1, day: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('TimetableSlot', slotSchema);
