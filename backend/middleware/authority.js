/**
 * Authority Authorization Middleware
 * Checks if the logged in user has the role of 'authority'.
 * If not, rejects the request with a 403 Forbidden status.
 */
const authority = (req, res, next) => {
  if (!req.user || req.user.role !== 'authority') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Authority role required.'
    });
  }
  next();
};

module.exports = authority;
