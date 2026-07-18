// ==============================================
// Auth Routes — Registration, Login, Profile
// ==============================================
// Defines the API endpoints for user authentication.
// Public routes: register and login
// Protected routes: getMe (requires valid JWT)

const express = require('express');
const router = express.Router();

// Import controller functions that contain the route logic
const { register, login, getMe } = require('../controllers/authController');

// Import the JWT protection middleware
const { protect } = require('../middleware/auth');

// ==============================================
// Route Definitions
// ==============================================

// @route   POST /api/auth/register
// @desc    Register a new user, hash password, return JWT
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Verify email/password credentials, return JWT
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get the currently logged-in user's profile
// @access  Private — requires a valid JWT token in the Authorization header
router.get('/me', protect, getMe);

module.exports = router;
