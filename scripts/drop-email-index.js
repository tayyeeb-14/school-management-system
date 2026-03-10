const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/database');

async function dropEmailIndex() {
  await connectDB();

  const db = mongoose.connection.db;
  const collName = 'users';

  try {
    const indexes = await db.collection(collName).indexes();
    const emailIndex = indexes.find(idx => {
      const key = idx.key || idx.keyPattern || {};
      return key.email === 1 && Object.keys(key).length === 1;
    });

    if (!emailIndex) {
      console.log('No email unique index found; nothing to drop.');
      process.exit(0);
    }

    console.log('Found index:', emailIndex.name);
    await db.collection(collName).dropIndex(emailIndex.name);
    console.log('Dropped email unique index:', emailIndex.name);
  } catch (err) {
    console.error('Error dropping index:', err.message);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
}

dropEmailIndex();
