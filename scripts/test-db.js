// scripts/test-db.js
// Quick script to validate DB connectivity using the same env/config logic as the app.
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management';

console.log('Attempting to connect to:', uri.includes('mongodb+srv') ? '(Atlas/remote) provided by MONGODB_URI' : uri);

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Test DB connection: SUCCESS');
    return mongoose.connection.close();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test DB connection: FAILED');
    console.error(err);
    process.exit(1);
  });
