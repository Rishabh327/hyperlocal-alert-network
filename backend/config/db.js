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
      // Atlas can take several seconds to answer from a cold host
      serverSelectionTimeoutMS: process.env.MONGO_URI ? 15000 : 2000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // In production (or whenever a real MONGO_URI is configured) never fall back
    // to an in-memory DB: it isn't installed there and would lose all data.
    if (process.env.MONGO_URI || process.env.NODE_ENV === 'production') {
      console.error(`MongoDB Connection Error: ${error.message}`);
      console.error('Check MONGO_URI and that Atlas Network Access allows 0.0.0.0/0');
      process.exit(1);
    }
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
