const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    classIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    timetable: [{
        day: String,
        period: Number,
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class'
        },
        subject: String,
        time: String
    }],
    qualifications: {
        type: String
    },
    monthlySalary: {
        type: Number,
        default: 0,
        min: 0
    },
    experience: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Teacher', teacherSchema);
