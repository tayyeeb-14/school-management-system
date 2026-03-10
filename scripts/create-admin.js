// scripts/create-admin.js
// Creates an admin user if one doesn't already exist.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('Error: MONGO_URI is not defined in .env file');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const username = process.argv[2] || 'admin';
    const email = process.argv[3] || 'admin@gmail.com';
    const password = process.argv[4] || 'admin';

    let admin = await User.findOne({ $or: [{ username }, { email }] });
    if (admin) {
      console.log('Admin user already exists:');
      console.log(`  username: ${admin.username}`);
      console.log(`  email: ${admin.email}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    admin = new User({
      username,
      password,
      name: 'Site Admin',
      email,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin user created successfully:');
    console.log(`  username: ${username}`);
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

run();
