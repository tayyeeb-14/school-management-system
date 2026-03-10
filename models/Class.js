const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    subjects: [{
        type: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Class', classSchema);