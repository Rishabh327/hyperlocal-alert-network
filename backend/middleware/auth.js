// ==============================================
// JWT Authentication Middleware
// ==============================================
// This middleware protects routes by verifying the JWT token
// sent in the Authorization header. If the token is valid,
// the decoded user data is attached to req.user so downstream
// route handlers can access the authenticated user.

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect - Middleware function that checks for a valid JWT
 * in the Authorization header (Bearer <token> format).
 * If valid, attaches the full user document to req.user.
 * If invalid or missing, returns a 401 Unauthorized response.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if the Authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Verify the token using our JWT secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user by the ID encoded in the token
      // Exclude the password field from the result
      req.user = await User.findById(decoded.id).select('-password');

      // If user no longer exists in the database
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists',
        });
      }

      // Token is valid, user is found — proceed to the route handler
      next();
    } catch (error) {
      // Token verification failed (expired, tampered, etc.)
      console.error('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token is invalid',
      });
    }
  }

  // No token was provided in the Authorization header
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

module.exports = { protect };
