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

// @route   GET /api/alerts/:id
// @desc    Get a single alert by its ID
// @access  Public
router.get('/:id', getAlertById);

module.exports = router;
