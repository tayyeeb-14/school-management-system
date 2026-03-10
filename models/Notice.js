const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    file: {
        type: String
    },
    category: {
        type: String,
        enum: ['general', 'exam', 'event', 'holiday', 'other'],
        default: 'general'
    },
    forClass: {
        type: String,
        default: 'all'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notice', noticeSchema);