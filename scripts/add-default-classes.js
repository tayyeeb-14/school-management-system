// scripts/add-default-classes.js
// Creates the standard 12 classes (Class I through Class XII)
// Run this after cleanup-sample-data.js

(async () => {
  try {
    require('dotenv').config();
    const mongoose = require('mongoose');
    const connectDB = require('../config/database');
    
    await connectDB();
    console.log('✓ Connected to database');

    const Class = require('../models/Class');

    // Standard classes to create
    const defaultClasses = [
      'Class I',
      'Class II',
      'Class III',
      'Class IV',
      'Class V',
      'Class VI',
      'Class VII',
      'Class VIII',
      'Class IX',
      'Class X',
      'Class XI',
      'Class XII'
    ];

    console.log('\n📚 Creating default classes...\n');

    const createdClasses = [];
    for (let i = 0; i < defaultClasses.length; i++) {
      const className = defaultClasses[i];
      
      // Check if class already exists
      const existing = await Class.findOne({ name: className });
      if (existing) {
        console.log(`  ⚠️  ${className} already exists (skipped)`);
        createdClasses.push(existing);
        continue;
      }

      // Create new class with order
      const newClass = new Class({
        name: className,
        active: true,
        order: i + 1,
        subjects: [],
        students: [],
        teacherId: null
      });

      await newClass.save();
      createdClasses.push(newClass);
      console.log(`  ✓ Created ${className}`);
    }

    console.log('\n✅ Default classes created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  • Total classes created: ${createdClasses.length}`);
    console.log(`  • Classes are active and ready for use`);
    console.log(`  • Teachers and subjects can now be assigned`);

    // List all classes in database
    const allClasses = await Class.find().sort({ order: 1 });
    console.log(`\n📋 All classes in database:`);
    allClasses.forEach((c, idx) => {
      console.log(`  ${idx + 1}. ${c.name} (active: ${c.active})`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Failed to create classes:', err && err.message ? err.message : err);
    console.error(err);
    process.exit(1);
  }
})();
