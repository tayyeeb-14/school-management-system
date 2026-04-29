function toAmount(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.round(numericValue * 100) / 100;
}

function normaliseMonthKey(monthLabel) {
    return String(monthLabel || '').trim().toLowerCase();
}

function parseMonthLabel(monthLabel) {
    if (!monthLabel) {
        return null;
    }

    const parsed = new Date(`${monthLabel} 1`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthLabel(date) {
    const source = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(source.getTime())) {
        return '';
    }

    return source.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
    });
}

function getMonthOptions({ monthsBack = 6, monthsForward = 12, fromDate = new Date() } = {}) {
    const baseDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const monthOptions = [];

    for (let offset = -monthsBack; offset <= monthsForward; offset += 1) {
        monthOptions.push(formatMonthLabel(new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1)));
    }

    return monthOptions;
}

function getDefaultDueDate(monthLabel) {
    const parsedMonth = parseMonthLabel(monthLabel);

    if (!parsedMonth) {
        return new Date();
    }

    return new Date(parsedMonth.getFullYear(), parsedMonth.getMonth(), 10, 12, 0, 0, 0);
}

function getDuePendingAmount(due) {
    return toAmount(Math.max(0, toAmount(due?.dueAmount) - toAmount(due?.paidAmount)));
}

function normaliseDue(due) {
    if (!due) {
        return null;
    }

    due.dueAmount = toAmount(due.dueAmount);
    due.paidAmount = Math.min(due.dueAmount || 0, toAmount(due.paidAmount));
    due.isPaid = getDuePendingAmount(due) === 0;

    return due;
}

function findDueByMonth(feeRecord, monthLabel) {
    if (!feeRecord?.monthlyDues?.length || !monthLabel) {
        return null;
    }

    const monthKey = normaliseMonthKey(monthLabel);
    return feeRecord.monthlyDues.find((due) => normaliseMonthKey(due.month) === monthKey) || null;
}

function ensureMonthlyDue(feeRecord, { month, dueAmount, dueDate } = {}) {
    if (!feeRecord.monthlyDues) {
        feeRecord.monthlyDues = [];
    }

    const resolvedMonth = month || formatMonthLabel(new Date());
    const resolvedAmount = toAmount(dueAmount);
    const resolvedDueDate = dueDate || getDefaultDueDate(resolvedMonth);

    let due = findDueByMonth(feeRecord, resolvedMonth);

    if (!due) {
        feeRecord.monthlyDues.push({
            month: resolvedMonth,
            dueAmount: resolvedAmount,
            dueDate: resolvedDueDate,
            isPaid: false,
            paidAmount: 0
        });

        due = feeRecord.monthlyDues[feeRecord.monthlyDues.length - 1];
    } else {
        if ((!due.dueAmount || toAmount(due.dueAmount) === 0) && resolvedAmount > 0) {
            due.dueAmount = resolvedAmount;
        }

        if (!due.dueDate && resolvedDueDate) {
            due.dueDate = resolvedDueDate;
        }
    }

    return normaliseDue(due);
}

function applyPaymentToDue(due, amount, paymentDate = new Date()) {
    const resolvedAmount = toAmount(amount);

    if (!due || resolvedAmount <= 0) {
        return {
            appliedAmount: 0,
            remainingAmount: resolvedAmount
        };
    }

    normaliseDue(due);

    const pendingAmount = getDuePendingAmount(due);
    if (pendingAmount <= 0) {
        due.isPaid = true;
        return {
            appliedAmount: 0,
            remainingAmount: resolvedAmount
        };
    }

    const appliedAmount = Math.min(pendingAmount, resolvedAmount);
    due.paidAmount = toAmount(due.paidAmount + appliedAmount);
    due.isPaid = getDuePendingAmount(due) === 0;
    due.paymentDate = paymentDate;

    return {
        appliedAmount,
        remainingAmount: toAmount(resolvedAmount - appliedAmount)
    };
}

function applyPaymentRecord(
    feeRecord,
    {
        amount,
        month,
        description,
        collectedFromClass = false,
        classId = null,
        monthlyDueId = null,
        standardMonthlyFee = 0,
        paymentDate = new Date()
    } = {}
) {
    if (!feeRecord.payments) {
        feeRecord.payments = [];
    }

    const resolvedAmount = toAmount(amount);
    const resolvedMonth = month || formatMonthLabel(paymentDate);
    const resolvedStandardFee = toAmount(standardMonthlyFee || feeRecord.totalDue || feeRecord.monthlyFee || resolvedAmount);

    const payment = {
        amount: resolvedAmount,
        month: resolvedMonth,
        description: description || `Fee payment for ${resolvedMonth}`,
        date: paymentDate,
        collectedFromClass,
        classId
    };

    feeRecord.payments.push(payment);

    let due = null;
    if (monthlyDueId && feeRecord.monthlyDues && typeof feeRecord.monthlyDues.id === 'function') {
        due = feeRecord.monthlyDues.id(monthlyDueId);
    }

    if (!due) {
        due = ensureMonthlyDue(feeRecord, {
            month: resolvedMonth,
            dueAmount: resolvedStandardFee || resolvedAmount,
            dueDate: getDefaultDueDate(resolvedMonth)
        });
    }

    const allocation = applyPaymentToDue(due, resolvedAmount, paymentDate);

    return {
        payment,
        due,
        allocation
    };
}

function buildFeeSummary(feeRecord, { standardMonthlyFee = 0, now = new Date() } = {}) {
    const payments = Array.isArray(feeRecord?.payments) ? feeRecord.payments : [];
    const dues = Array.isArray(feeRecord?.monthlyDues) ? feeRecord.monthlyDues : [];

    const totalPaid = toAmount(payments.reduce((sum, payment) => sum + toAmount(payment.amount), 0));

    let totalAssigned = 0;
    let overdueAmount = 0;
    let upcomingAmount = 0;
    let paidDuesCount = 0;
    let unpaidDuesCount = 0;

    dues.forEach((due) => {
        normaliseDue(due);

        const dueAmount = toAmount(due.dueAmount);
        const pendingAmount = getDuePendingAmount(due);

        totalAssigned = toAmount(totalAssigned + dueAmount);

        if (pendingAmount > 0) {
            unpaidDuesCount += 1;

            if (due.dueDate && new Date(due.dueDate) < now) {
                overdueAmount = toAmount(overdueAmount + pendingAmount);
            } else {
                upcomingAmount = toAmount(upcomingAmount + pendingAmount);
            }
        } else {
            paidDuesCount += 1;
        }
    });

    return {
        standardMonthlyFee: toAmount(standardMonthlyFee),
        totalPaid,
        totalAssigned,
        outstandingBalance: toAmount(overdueAmount + upcomingAmount),
        overdueAmount,
        upcomingAmount,
        creditAmount: toAmount(Math.max(0, totalPaid - totalAssigned)),
        paidDuesCount,
        unpaidDuesCount,
        paymentCount: payments.length,
        dueCount: dues.length
    };
}

function sortPaymentsByDateDesc(payments = []) {
    return [...payments].sort((left, right) => new Date(right.date) - new Date(left.date));
}

function sortDuesByDateDesc(dues = []) {
    return [...dues].sort((left, right) => {
        const leftDate = left?.dueDate ? new Date(left.dueDate) : parseMonthLabel(left?.month) || new Date(0);
        const rightDate = right?.dueDate ? new Date(right.dueDate) : parseMonthLabel(right?.month) || new Date(0);
        return rightDate - leftDate;
    });
}

function buildDueEntries(dues = [], now = new Date()) {
    return sortDuesByDateDesc(dues).map((due) => {
        normaliseDue(due);

        const pendingAmount = getDuePendingAmount(due);
        const isOverdue = pendingAmount > 0 && due.dueDate && new Date(due.dueDate) < now;

        return {
            due,
            pendingAmount,
            isOverdue,
            isPaid: pendingAmount === 0
        };
    });
}

function rebuildDueLedger(feeRecord, { standardMonthlyFee = 0 } = {}) {
    if (!feeRecord.monthlyDues) {
        feeRecord.monthlyDues = [];
    }

    feeRecord.monthlyDues.forEach((due) => {
        due.paidAmount = 0;
        due.isPaid = false;
        due.paymentDate = null;
        normaliseDue(due);
    });

    const orderedPayments = [...(feeRecord.payments || [])].sort((left, right) => new Date(left.date) - new Date(right.date));

    orderedPayments.forEach((payment) => {
        const due = ensureMonthlyDue(feeRecord, {
            month: payment.month,
            dueAmount: toAmount(standardMonthlyFee || feeRecord.totalDue || feeRecord.monthlyFee || payment.amount),
            dueDate: getDefaultDueDate(payment.month)
        });

        applyPaymentToDue(due, payment.amount, payment.date ? new Date(payment.date) : new Date());
    });
}

module.exports = {
    applyPaymentRecord,
    buildDueEntries,
    buildFeeSummary,
    ensureMonthlyDue,
    formatMonthLabel,
    getDefaultDueDate,
    getDuePendingAmount,
    getMonthOptions,
    normaliseDue,
    parseMonthLabel,
    rebuildDueLedger,
    sortDuesByDateDesc,
    sortPaymentsByDateDesc,
    toAmount
};
