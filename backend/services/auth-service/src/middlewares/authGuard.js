/**
 * middlewares/authGuard.js
 *
 * JWT Authentication Middleware.
 *
 * This middleware protects routes — any route that requires a logged-in user
 * must pass through this middleware first.
 *
 * HOW IT WORKS:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify the JWT signature using our secret
 * 3. Attach the decoded payload (userId, role) to req.user
 * 4. Call next() to proceed to the controller
 *
 * If any step fails, respond with 401 Unauthorized.
 */

const jwt = require('jsonwebtoken');
const ApiResponse = require('../utils/apiResponse');

/**
 * Verifies access token and attaches user to req.
 * Usage: router.get('/profile', authGuard, profileController)
 */
const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Authorization header must be: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ApiResponse.error(res, 401, 'Authentication required. Please log in.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Attach user info to the request object for downstream handlers
    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 401, 'Access token expired. Please refresh your session.');
    }
    return ApiResponse.error(res, 401, 'Invalid access token.');
  }
};

/**
 * Role-based authorization — use AFTER authGuard.
 * Usage: router.delete('/admin/users/:id', authGuard, requireRole('admin'), deleteUser)
 *
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 401, 'Authentication required.');
    }

    if (!roles.includes(req.user.role)) {
      return ApiResponse.error(res, 403, 'You do not have permission to perform this action.');
    }

    next();
  };
};

module.exports = { authGuard, requireRole };
