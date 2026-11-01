const mongoose = require('mongoose');

/**
 * Photo Schema
 * Stores uploaded alert photos as binary data so they persist on hosts
 * with ephemeral file systems. Served publicly via GET /photos/:id.
 */
const PhotoSchema = new mongoose.Schema({
  data: {
    type: Buffer,
    required: true
  },
  contentType: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Photo', PhotoSchema);
