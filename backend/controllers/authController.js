// ==============================================
// Auth Controller — Registration & Login Logic
// ==============================================
// Handles user registration, login, and fetching the
// currently authenticated user's profile. Generates
// JWT tokens upon successful authentication.

const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ==============================================
// Helper — Generate JWT Token
// ==============================================
// Creates a signed JWT with the user's ID as the payload.
// The token expires in 30 days.
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// ==============================================
// @route   POST /api/auth/register
// @desc    Register a new user account
// @access  Public
// ==============================================
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate that all required fields are present
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    // Create the new user — password will be hashed by the pre-save hook
    const user = await User.create({
      name,
      email,
      password,
      phone,
    });

    // Generate a JWT token for the new user
    const token = generateToken(user._id);

    // Return success response with user data and token
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        alertsReported: user.alertsReported,
        credibilityScore: user.credibilityScore,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    // Handle duplicate key errors (e.g., duplicate email)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

// ==============================================
// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT token
// @access  Public
// ==============================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate that email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find the user by email — explicitly select the password field
    // (it's excluded by default in the schema with select: false)
    const user = await User.findOne({ email }).select('+password');

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare the entered password with the hashed password in the database
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate a JWT token for the authenticated user
    const token = generateToken(user._id);

    // Return success response with user data and token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        alertsReported: user.alertsReported,
        credibilityScore: user.credibilityScore,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// ==============================================
// @route   GET /api/auth/me
// @desc    Get the currently logged-in user's profile
// @access  Private (requires valid JWT token)
// ==============================================
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware after verifying the JWT
    const user = req.user;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location,
        alertsReported: user.alertsReported,
        credibilityScore: user.credibilityScore,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user profile',
    });
  }
};

module.exports = { register, login, getMe };
