// ==============================================
// Alert Model — Mongoose Schema Definition
// ==============================================
// Defines the Alert schema for emergency/disaster reports.
// Each alert has a title, type, description, GeoJSON location,
// optional photo, reporter reference, status, credibility score,
// corroborations from other users, and an auto-expiry time.

const mongoose = require('mongoose');

// Define the Alert schema with all required fields
const AlertSchema = new mongoose.Schema({
  // Alert title — short summary of the emergency
  title: {
    type: String,
    required: [true, 'Please provide an alert title'],
    trim: true,
    maxlength: [120, 'Title cannot be more than 120 characters'],
  },

  // Type of emergency — determines marker color on the map
  type: {
    type: String,
    required: [true, 'Please specify the alert type'],
    enum: {
      values: ['flood', 'fire', 'accident', 'gas_leak', 'medical', 'earthquake', 'other'],
      message: '{VALUE} is not a valid alert type',
    },
  },

  // Detailed description of the emergency situation
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
  },

  // GeoJSON Point — required for geospatial queries
  // Stores the exact location of the emergency as [longitude, latitude]
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Please provide location coordinates'],
    },
  },

  // Optional photo file path — stored in the uploads/ folder
  photo: {
    type: String,
  },

  // Reference to the User who reported this alert
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Alert verification status
  // unverified = newly reported, verified = confirmed by authorities/users,
  // flagged = reported as false/spam
  status: {
    type: String,
    enum: ['unverified', 'verified', 'flagged'],
    default: 'unverified',
  },

  // Credibility score — increases as more users corroborate the alert
  // Starts at 50; each corroboration adds 10 points
  credibilityScore: {
    type: Number,
    default: 50,
  },

  // Array of User references who have confirmed this alert
  corroborations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  // Number of users who have confirmed this alert
  corroborationCount: {
    type: Number,
    default: 0,
  },

  // Confidence score from AI service
  confidence: {
    type: Number,
    default: 50,
  },

  // Impact factors from AI service
  factors: { type: Object, default: {} },

  // Whether the alert is currently active
  // Set to false when alert expires or is manually deactivated
  isActive: {
    type: Boolean,
    default: true,
  },

  // Timestamp when the alert was created
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Timestamp when the alert expires — default is 6 hours from creation
  // MongoDB TTL or manual checks can deactivate expired alerts
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
  },
});

// ==============================================
// 2dsphere Index — Required for Geospatial Queries
// ==============================================
// This index enables $nearSphere, $geoWithin, and other
// geospatial operators on the location field
AlertSchema.index({ location: '2dsphere' });

// Index on expiresAt for efficient expiry queries
AlertSchema.index({ expiresAt: 1 });

// Index on isActive for filtering active alerts
AlertSchema.index({ isActive: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
