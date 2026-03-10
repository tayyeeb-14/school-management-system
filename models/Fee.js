const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    monthlyFee: {
        type: Number,
        default: 0
    },
    payments: [{
        amount: Number,
        date: {
            type: Date,
            default: Date.now
        },
        month: String, // e.g., "January 2026"
        description: String,
        collectedFromClass: {
            type: Boolean,
            default: false
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class'
        }
    }],
    monthlyDues: [{
        month: String, // e.g., "January 2026"
        dueAmount: Number,
        dueDate: Date,
        isPaid: {
            type: Boolean,
            default: false
        },
        paidAmount: {
            type: Number,
            default: 0
        }
    }],
    totalDue: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for total paid
feeSchema.virtual('totalPaid').get(function() {
    return this.payments.reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for balance
feeSchema.virtual('balance').get(function() {
    return this.totalDue - this.totalPaid;
});

// Virtual for overdue amount
feeSchema.virtual('overdueAmount').get(function() {
    const now = new Date();
    return this.monthlyDues.reduce((sum, due) => {
        if (!due.isPaid && new Date(due.dueDate) < now) {
            return sum + (due.dueAmount - due.paidAmount);
        }
        return sum;
    }, 0);
});

module.exports = mongoose.model('Fee', feeSchema);