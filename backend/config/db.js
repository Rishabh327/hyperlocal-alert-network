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
    // Attempt to connect to MongoDB with the URI from .env
    const conn = await mongoose.connect(process.env.MONGO_URI);

    // Log the connected host for confirmation
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log the error message and exit the process
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
