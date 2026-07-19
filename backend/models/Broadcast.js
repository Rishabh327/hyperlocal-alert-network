const mongoose = require('mongoose');

/**
 * Broadcast Schema
 * Stores official alerts sent out by authorities targeting specific geographic zones.
 */
const BroadcastSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, 'Please provide a broadcast message'],
    trim: true,
    maxlength: [200, 'Message cannot be more than 200 characters']
  },
  zone: {
    lat: {
      type: Number,
      required: [true, 'Please provide zone center latitude']
    },
    lng: {
      type: Number,
      required: [true, 'Please provide zone center longitude']
    },
    radius: {
      type: Number,
      required: [true, 'Please provide zone radius (in km)']
    }
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  affectedCount: {
    type: Number,
    required: true,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Broadcast', BroadcastSchema);
