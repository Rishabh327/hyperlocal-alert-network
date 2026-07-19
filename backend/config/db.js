// ==============================================
// MongoDB Database Connection Configuration
// ==============================================
// This module establishes a connection to MongoDB using Mongoose.
// It reads the connection URI from environment variables and
// handles connection success/failure gracefully.

const mongoose = require('mongoose');

/**
 * connectDB - Connects to MongoDB Atlas using the MONGO_URI
 * environment variable. Logs the host on success or exits
 * the process with code 1 on failure.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    )
    console.log(`MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`)
    console.error("Please check your MONGO_URI in .env file")
    process.exit(1)
  }
};

module.exports = connectDB;
