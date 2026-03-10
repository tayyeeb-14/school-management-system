const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    rollNo: {
        type: String,
        sparse: true // Allow null values but unique when present
    },
    fatherName: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved'],
        default: 'pending'
    },
    subjects: [{
        type: String
    }],
    marks: [{
        subject: String,
        marks: Number,
        outOf: Number,
        examType: String,
        date: Date
    }],
    attendance: [{
        date: Date,
        status: {
            type: String,
            enum: ['present', 'absent'],
            default: 'present'
        }
    }]
});

// Virtual for attendance percentage
studentSchema.virtual('attendancePercentage').get(function() {
    if (!this.attendance.length) return 0;
    
    const present = this.attendance.filter(a => a.status === 'present').length;
    return Math.round((present / this.attendance.length) * 100);
});

// Ensure rollNo is unique only within the same class
studentSchema.index({ classId: 1, rollNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Student', studentSchema);