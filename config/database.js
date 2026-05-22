require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected (Atlas)");
  } catch (error) {
    // Log error but do not abort server startup — UI verification can proceed without DB.
    // This avoids taking down the app during local UI checks when Atlas/DNS is unreachable.
    console.error("MongoDB Connection Error:", error && error.message ? error.message : error);
    // Do not exit; return so callers can continue. Routes that require DB will still fail when used.
    return;
  }
};

module.exports = connectDB;
