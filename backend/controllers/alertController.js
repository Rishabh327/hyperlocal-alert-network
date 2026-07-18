// ==============================================
// Alert Controller — CRUD and Real-Time Logic
// ==============================================
// Handles creating alerts (with socket.io broadcast),
// fetching nearby alerts via geospatial queries,
// corroborating alerts, fetching single alerts,
// and fetching the current user's reported alerts.

const Alert = require('../models/Alert');
const User = require('../models/User');

// ==============================================
// @route   POST /api/alerts
// @desc    Submit a new emergency alert
// @access  Private (requires JWT)
// ==============================================
const createAlert = async (req, res) => {
  try {
    const { title, type, description, latitude, longitude } = req.body;

    // Validate required fields
    if (!title || !type || !description || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, type, description, and location coordinates',
      });
    }

    // Parse coordinates as floats
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude values',
      });
    }

    // Build the alert data object
    const alertData = {
      title,
      type,
      description,
      location: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON uses [longitude, latitude]
      },
      reportedBy: req.user._id,
    };

    // If a photo was uploaded via multer, save its path
    if (req.file) {
      alertData.photo = `/uploads/${req.file.filename}`;
    }

    // Save the alert to MongoDB
    const alert = await Alert.create(alertData);

    // Populate the reporter's name for the response and socket broadcast
    const populatedAlert = await Alert.findById(alert._id).populate(
      'reportedBy',
      'name email role credibilityScore'
    );

    // Increment the reporting user's alertsReported count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { alertsReported: 1 },
    });

    // ==============================================
    // Real-Time Broadcast — Emit to All Connected Clients
    // ==============================================
    // The io instance is attached to req by the route middleware
    const io = req.app.get('io');
    if (io) {
      io.emit('new_alert', populatedAlert);
    }

    res.status(201).json({
      success: true,
      message: 'Alert reported successfully',
      alert: populatedAlert,
    });
  } catch (error) {
    console.error('Create alert error:', error.message);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating alert',
    });
  }
};

// ==============================================
// @route   GET /api/alerts/nearby
// @desc    Get all active alerts within a radius
// @access  Public (anyone can view alerts)
// ==============================================
const getNearbyAlerts = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    // Validate query parameters
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lat and lng query parameters',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    // Default radius: 5km, convert to meters for MongoDB
    const radiusKm = parseFloat(radius) || 5;
    const radiusMeters = radiusKm * 1000;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lat or lng values',
      });
    }

    // Use $nearSphere to find alerts within the specified radius
    // MongoDB uses radians for $maxDistance with $nearSphere
    // Earth's radius ≈ 6378.1 km
    const alerts = await Alert.find({
      isActive: true,
      expiresAt: { $gt: new Date() }, // Only return non-expired alerts
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters, // in meters
        },
      },
    })
      .populate('reportedBy', 'name role credibilityScore')
      .sort({ createdAt: -1 })
      .limit(100); // Cap results to prevent overload

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Get nearby alerts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching nearby alerts',
    });
  }
};

// ==============================================
// @route   POST /api/alerts/:id/corroborate
// @desc    Confirm/corroborate an existing alert
// @access  Private (requires JWT)
// ==============================================
const corroborateAlert = async (req, res) => {
  try {
    const alertId = req.params.id;
    const userId = req.user._id;

    // Find the alert by ID
    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    // Check if the user has already corroborated this alert
    if (alert.corroborations.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already confirmed this alert',
      });
    }

    // Prevent the reporter from corroborating their own alert
    if (alert.reportedBy.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot confirm your own alert',
      });
    }

    // Add the user to corroborations, increment count and credibility
    alert.corroborations.push(userId);
    alert.corroborationCount += 1;
    alert.credibilityScore += 10;

    // If credibility score exceeds 100, cap it
    if (alert.credibilityScore > 100) {
      alert.credibilityScore = 100;
    }

    // Auto-verify if enough corroborations (e.g., 3+ confirmations)
    if (alert.corroborationCount >= 3 && alert.status === 'unverified') {
      alert.status = 'verified';
    }

    await alert.save();

    // Populate the alert for the response
    const updatedAlert = await Alert.findById(alertId)
      .populate('reportedBy', 'name role credibilityScore')
      .populate('corroborations', 'name');

    // ==============================================
    // Real-Time Broadcast — Emit Updated Alert
    // ==============================================
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
    }

    res.status(200).json({
      success: true,
      message: 'Alert confirmed successfully',
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('Corroborate alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming alert',
    });
  }
};

// ==============================================
// @route   GET /api/alerts/:id
// @desc    Get a single alert by ID
// @access  Public
// ==============================================
const getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('reportedBy', 'name role credibilityScore')
      .populate('corroborations', 'name');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Get alert error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching alert',
    });
  }
};

// ==============================================
// @route   GET /api/alerts/my
// @desc    Get all alerts reported by the logged-in user
// @access  Private (requires JWT)
// ==============================================
const getMyAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ reportedBy: req.user._id })
      .populate('reportedBy', 'name role credibilityScore')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Get my alerts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your alerts',
    });
  }
};

module.exports = {
  createAlert,
  getNearbyAlerts,
  corroborateAlert,
  getAlertById,
  getMyAlerts,
};
