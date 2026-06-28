const mongoose = require('mongoose');
const Class = require('../models/Class');

function normalizeClassName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function getActiveClasses() {
    return Class.find({ active: true }).sort({ order: 1, name: 1 });
}

function getAllClasses() {
    return Class.find().sort({ order: 1, name: 1 });
}

async function findActiveClass(classId) {
    if (!mongoose.isValidObjectId(classId)) return null;
    return Class.findOne({ _id: classId, active: true });
}

async function findClassByName(name, excludeId = null) {
    const normalizedName = normalizeClassName(name);
    if (!normalizedName) return null;

    const filter = { name: normalizedName };
    if (excludeId) filter._id = { $ne: excludeId };

    return Class.findOne(filter).collation({ locale: 'en', strength: 2 });
}

async function getNextClassOrder() {
    const lastClass = await Class.findOne().sort({ order: -1 }).select('order').lean();
    return Number(lastClass?.order || 0) + 1;
}

module.exports = {
    findActiveClass,
    findClassByName,
    getActiveClasses,
    getAllClasses,
    getNextClassOrder,
    normalizeClassName
};
