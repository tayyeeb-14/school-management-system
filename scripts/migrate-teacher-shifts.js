/* One-off migration:
 * Read TeacherShift documents, parse legacy "lat:...,lng:..." strings in
 * checkInLocation/checkOutLocation and write numeric fields:
 *   checkInLat, checkInLng, checkOutLat, checkOutLng
 * Only updates documents where numeric fields are missing.
 */

const mongoose = require('mongoose');
const TeacherShift = require('../models/TeacherShift');
const dbConfig = require('../config/database');

async function run() {
  try {
    await dbConfig();
    console.log('Connected to DB');

    const cursor = TeacherShift.find().cursor();
    let total = 0;
    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      total++;
      let changed = false;

      if ((doc.checkInLat == null || doc.checkInLng == null) && doc.checkInLocation) {
        const mLat = String(doc.checkInLocation).match(/lat:([\-0-9.]+)/);
        const mLng = String(doc.checkInLocation).match(/lng:([\-0-9.]+)/);
        if (mLat && mLng) {
          doc.checkInLat = Number(mLat[1]);
          doc.checkInLng = Number(mLng[1]);
          changed = true;
        }
      }

      if ((doc.checkOutLat == null || doc.checkOutLng == null) && doc.checkOutLocation) {
        const mLat = String(doc.checkOutLocation).match(/lat:([\-0-9.]+)/);
        const mLng = String(doc.checkOutLocation).match(/lng:([\-0-9.]+)/);
        if (mLat && mLng) {
          doc.checkOutLat = Number(mLat[1]);
          doc.checkOutLng = Number(mLng[1]);
          changed = true;
        }
      }

      if (changed) {
        await doc.save();
        updated++;
      }
    }

    console.log(`Processed ${total} shifts, updated ${updated} documents.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration error', err);
    process.exit(2);
  }
}

run();
