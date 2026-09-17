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
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hyperlocal';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Local MongoDB Connection Error (${error.message}). Starting MongoMemoryServer...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`In-Memory MongoDB Connected: ${conn.connection.host}`);
    } catch (memErr) {
      console.error(`MongoDB Connection Error: ${memErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
