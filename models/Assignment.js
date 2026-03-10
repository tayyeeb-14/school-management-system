const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    file: {
        type: String
    },
    dueDate: {
        type: Date,
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submissions: [{
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        file: String,
        submittedAt: {
            type: Date,
            default: Date.now
        },
        marks: {
            type: Number,
            default: null
        },
        feedback: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Assignment', assignmentSchema);