const mongoose = require('mongoose');

const classFeeSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
        unique: true
    },
    fees: [{
        name: {
            type: String,
            required: true // e.g., "Tuition Fee", "Transport Fee", "Exam Fee"
        },
        amount: {
            type: Number,
            required: true
        },
        frequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
            default: 'monthly'
        }
    }],
    totalMonthlyFee: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for total monthly fee calculation
classFeeSchema.virtual('calculatedMonthlyFee').get(function() {
    return this.fees.reduce((sum, fee) => {
        if (fee.frequency === 'monthly') {
            return sum + fee.amount;
        }
        return sum;
    }, 0);
});

// Keep `totalMonthlyFee` in sync for existing code that reads it.
classFeeSchema.pre('save', function(next) {
    try {
        const total = Array.isArray(this.fees)
            ? this.fees.reduce((sum, f) => (f && f.frequency === 'monthly' ? sum + Number(f.amount || 0) : sum), 0)
            : 0;
        this.totalMonthlyFee = Math.round(total * 100) / 100;
    } catch (e) {
        // ignore and continue
    }
    next();
});

module.exports = mongoose.model('ClassFee', classFeeSchema);