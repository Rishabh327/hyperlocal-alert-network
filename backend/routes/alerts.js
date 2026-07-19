// ==============================================
// Alert Routes — CRUD and Corroboration Endpoints
// ==============================================
// Defines the API endpoints for the alert system.
// Includes multer middleware for photo upload handling.
// Public routes: get nearby alerts, get alert by ID
// Protected routes: create alert, corroborate alert, get my alerts

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Import Alert and User models
const Alert = require('../models/Alert');
const User = require('../models/User');

// Import controller functions
const {
  createAlert,
  getNearbyAlerts,
  corroborateAlert,
  getAlertById,
  getMyAlerts,
} = require('../controllers/alertController');

// Import the JWT protection middleware
const { protect } = require('../middleware/auth');

// ==============================================
// Multer Configuration — Photo Upload Handling
// ==============================================
// Configure where and how uploaded photos are stored.
// Files are saved to the /uploads directory with unique
// filenames to prevent collisions.
const storage = multer.diskStorage({
  // Set the destination folder for uploaded files
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  // Generate a unique filename using UUID to avoid collisions
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `alert-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter — only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

// Create the multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// ==============================================
// Route Definitions
// ==============================================

// @route   GET /api/alerts/nearby
// @desc    Get all active alerts within a radius using geospatial query
// @access  Public
// NOTE: This route must be defined BEFORE /:id to prevent "nearby"
//       from being interpreted as an alert ID
router.get('/nearby', getNearbyAlerts);

// @route   GET /api/alerts/my
// @desc    Get all alerts reported by the logged-in user
// @access  Private
// NOTE: This route must also be defined BEFORE /:id
router.get('/my', protect, getMyAlerts);

// @route   POST /api/alerts
// @desc    Submit a new emergency alert with optional photo upload
// @access  Private (requires JWT)
router.post('/', protect, upload.single('photo'), createAlert);

// @route   POST /api/alerts/:id/corroborate
// @desc    Confirm/corroborate an existing alert
// @access  Private (requires JWT)
router.post('/:id/corroborate', protect, corroborateAlert);

// @route   POST /api/alerts/:id/grievance
// @desc    Report a grievance against an alert (report as false/spam)
// @access  Private (requires JWT)
router.post('/:id/grievance', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if this user has already submitted a grievance for this alert
    const alreadySubmitted = alert.grievances?.some(
      (g) => g.reportedBy.toString() === req.user._id.toString()
    );
    if (alreadySubmitted) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this alert as false'
      });
    }

    // Push new grievance to array
    alert.grievances.push({
      reportedBy: req.user._id,
      reason: reason.trim(),
      createdAt: new Date()
    });

    // Check if grievances count is >= 3
    if (alert.grievances.length >= 3) {
      alert.status = 'flagged';
      alert.credibilityScore = Math.max(0, alert.credibilityScore - 15);
    }

    await alert.save();

    // Populate user details before socket emit
    const updatedAlert = await Alert.findById(alert._id)
      .populate('reportedBy', 'name role credibilityScore')
      .populate('corroborations', 'name');

    // Retrieve io from the app instance (req.app.get('io')) and emit if available
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
      console.log(`Socket broadcast 'alert_updated' sent for grievance against alert ID: ${alert._id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Grievance recorded',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Grievance route error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while recording grievance'
    });
  }
});

// @route   GET /api/alerts/:id
// @desc    Get a single alert by its ID
// @access  Public
router.get('/:id', getAlertById);

// @route   PUT /api/alerts/:id/score
// @desc    Receive credibility score and status updates from the AI microservice
// @access  Internal (No auth required)
router.put('/:id/score', async (req, res) => {
  try {
    const alertId = req.params.id;
    const { credibility_score, status, confidence, factors } = req.body;

    if (credibility_score === undefined || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: credibility_score and status'
      });
    }

    // Find and update the alert in the database
    const updatedAlert = await Alert.findByIdAndUpdate(
      alertId,
      {
        credibilityScore: credibility_score,
        status: status,
        confidence: confidence !== undefined ? confidence : 50,
        factors: factors || { corroboration_impact: 0, reporter_trust: 0, type_risk: 0, time_penalty: 0 }
      },
      { new: true }
    )
      .populate('reportedBy', 'name role credibilityScore')
      .populate('corroborations', 'name');

    if (!updatedAlert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Emit real-time update socket event to automatically update client UI/Map markers
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
      console.log(`Socket broadcast 'alert_updated' sent for alert ID: ${alertId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Alert credibility score and status updated successfully',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Update alert score error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while updating alert score'
    });
  }
});

// @route   POST /api/alerts/:id/feedback
// @desc    Process authority feedback (genuine vs false) for credibility score calibration
// @access  Private (Authority only)
router.post('/:id/feedback', protect, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Authority role required'
      });
    }

    const { feedback_type } = req.body;
    if (!feedback_type || (feedback_type !== 'genuine' && feedback_type !== 'false')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing feedback_type. Must be "genuine" or "false"'
      });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Call Python scoring service feedback endpoint
    try {
      await axios.post('http://localhost:5001/feedback', {
        alert_id: alert._id.toString(),
        feedback_type: feedback_type,
        factors_used: alert.factors || {}
      });
    } catch (pythonErr) {
      console.error('Python scoring feedback error:', pythonErr.message);
    }

    // Update alert status
    alert.status = feedback_type === 'genuine' ? 'verified' : 'flagged';
    alert.grievances = [];
    await alert.save();

    // Update the reporting user's credibility score
    const reporter = await User.findById(alert.reportedBy);
    if (reporter) {
      if (feedback_type === 'genuine') {
        reporter.credibilityScore = Math.min(100, (reporter.credibilityScore || 0) + 5);
      } else {
        reporter.credibilityScore = Math.max(0, (reporter.credibilityScore || 0) - 10);
      }
      await reporter.save();
    }

    const updatedAlert = await Alert.findById(alert._id)
      .populate('reportedBy', 'name role credibilityScore')
      .populate('corroborations', 'name');

    // Emit socket event to notify clients
    const io = req.app.get('io');
    if (io) {
      io.emit('alert_updated', updatedAlert);
    }

    res.status(200).json({
      success: true,
      message: 'Feedback processed successfully',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Feedback route error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while processing authority feedback'
    });
  }
});

module.exports = router;
