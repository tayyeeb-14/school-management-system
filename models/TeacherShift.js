const mongoose = require('mongoose');

const teacherShiftSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    checkInAt: Date,
    checkOutAt: Date,
    // New numeric lat/lng fields for reliable storage and querying
    checkInLat: { type: Number },
    checkInLng: { type: Number },
    checkOutLat: { type: Number },
    checkOutLng: { type: Number },
    // Backwards-compatible string fields (kept for migration/readability)
    checkInLocation: {
        type: String,
        default: 'unknown'
    },
    checkOutLocation: {
        type: String,
        default: 'unknown'
    },
    durationMinutes: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

teacherShiftSchema.index({ teacherId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TeacherShift', teacherShiftSchema);
