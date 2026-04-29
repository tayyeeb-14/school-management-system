const mongoose = require('mongoose');

function toAmount(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.round(numericValue * 100) / 100;
}

function getPendingAmount(due) {
    return toAmount(Math.max(0, toAmount(due?.dueAmount) - toAmount(due?.paidAmount)));
}

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
        },
        paymentDate: {
            type: Date,
            default: null
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
    return toAmount(this.payments.reduce((sum, payment) => sum + toAmount(payment.amount), 0));
});

// Virtual for total assigned due amount
feeSchema.virtual('totalAssigned').get(function() {
    return toAmount(this.monthlyDues.reduce((sum, due) => sum + toAmount(due.dueAmount), 0));
});

// Virtual for balance
feeSchema.virtual('balance').get(function() {
    if (this.monthlyDues.length > 0) {
        return toAmount(this.monthlyDues.reduce((sum, due) => sum + getPendingAmount(due), 0));
    }

    return toAmount(Math.max(0, toAmount(this.totalDue) - this.totalPaid));
});

// Virtual for overpayment / advance amount
feeSchema.virtual('creditAmount').get(function() {
    return toAmount(Math.max(0, this.totalPaid - this.totalAssigned));
});

// Virtual for overdue amount
feeSchema.virtual('overdueAmount').get(function() {
    const now = new Date();
    return this.monthlyDues.reduce((sum, due) => {
        if (getPendingAmount(due) > 0 && due.dueDate && new Date(due.dueDate) < now) {
            return toAmount(sum + getPendingAmount(due));
        }
        return sum;
    }, 0);
});

module.exports = mongoose.model('Fee', feeSchema);
