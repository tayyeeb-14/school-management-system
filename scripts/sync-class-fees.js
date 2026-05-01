const connectDB = require('../config/database');
const mongoose = require('mongoose');
const ClassFee = require('../models/ClassFee');

async function sync() {
  await connectDB();

  try {
    const classFees = await ClassFee.find();
    console.log(`Found ${classFees.length} ClassFee documents`);

    for (const cf of classFees) {
      const total = Array.isArray(cf.fees)
        ? cf.fees.reduce((sum, f) => (f && f.frequency === 'monthly' ? sum + Number(f.amount || 0) : sum), 0)
        : 0;
      cf.totalMonthlyFee = Math.round(total * 100) / 100;
      await cf.save();
      console.log(`Updated ClassFee ${cf._id} -> totalMonthlyFee=${cf.totalMonthlyFee}`);
    }

    console.log('Sync complete');
  } catch (err) {
    console.error('Error during sync:', err);
  } finally {
    mongoose.disconnect();
  }
}

sync().catch((e) => {
  console.error(e);
  process.exit(1);
});
