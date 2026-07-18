// ==============================================
// User Model — Mongoose Schema Definition
// ==============================================
// Defines the User schema for the Hyperlocal Alert Network.
// Each user has a name, email, hashed password, phone, role,
// GeoJSON location, and metrics for tracking alert credibility.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the User schema with all required fields
const UserSchema = new mongoose.Schema({
  // User's full name — required for identification
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters'],
  },

  // User's email — must be unique, used for login
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },

  // User's password — will be hashed before saving
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password in queries by default
  },

  // User's phone number — optional field
  phone: {
    type: String,
    trim: true,
  },

  // User's role — either a regular citizen or an authority figure
  role: {
    type: String,
    enum: ['citizen', 'authority'],
    default: 'citizen',
  },

  // User's last known location — stored as GeoJSON Point
  // This enables geospatial queries for nearby alerts
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },

  // Timestamp for when the user account was created
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Number of alerts this user has reported
  alertsReported: {
    type: Number,
    default: 0,
  },

  // Credibility score — tracks how accurate this reporter's alerts are
  // Starts at 100; increases with verified alerts, decreases with false ones
  credibilityScore: {
    type: Number,
    default: 100,
  },
});

// ==============================================
// Pre-save Middleware — Hash Password Before Saving
// ==============================================
// This runs before every save() call. If the password field
// has been modified, it hashes the password with bcrypt.
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  // Generate a salt with 10 rounds and hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ==============================================
// Instance Method — Compare Entered Password with Hashed Password
// ==============================================
// Used during login to verify the user's password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create a 2dsphere index on the location field for geospatial queries
UserSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', UserSchema);
