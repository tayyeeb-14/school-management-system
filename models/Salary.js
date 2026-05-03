const mongoose = require('mongoose');

const salaryPaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const salarySchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/
  },
  baseSalary: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  payments: {
    type: [salaryPaymentSchema],
    default: []
  },
  paidAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  remainingAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  }
}, {
  timestamps: true
});

salarySchema.index({ teacherId: 1, month: 1 }, { unique: true });

salarySchema.methods.recalculate = function recalculate() {
  const totalPaid = (this.payments || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const baseSalary = Number(this.baseSalary) || 0;
  this.paidAmount = Math.max(0, Number(totalPaid.toFixed(2)));
  this.remainingAmount = Math.max(0, Number((baseSalary - this.paidAmount).toFixed(2)));

  if (this.paidAmount <= 0) this.status = 'unpaid';
  else if (this.remainingAmount <= 0) this.status = 'paid';
  else this.status = 'partial';
};

salarySchema.pre('save', function salaryPreSave(next) {
  this.recalculate();
  next();
});

module.exports = mongoose.model('Salary', salarySchema);
