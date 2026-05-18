/**
 * middlewares/errorHandler.js
 *
 * Global Error Handler — the last middleware in the Express chain.
 *
 * WHY CENTRALIZE ERROR HANDLING?
 * Without this, every controller would need try/catch blocks that manually
 * send error responses. One bug in a single controller's error handling
 * leaks a stack trace to the user in production.
 *
 * With this:
 * - All errors are handled consistently
 * - No stack traces leak to clients in production
 * - All errors are logged with context
 * - We can distinguish between operational errors (expected, safe to show)
 *   and programmer errors (unexpected, hide from users)
 */

const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { AuthError, ValidationError } = require('../services/authService');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log with full context — request ID would be added here in production
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  // Handle domain-specific errors with appropriate HTTP status codes
  if (err instanceof ValidationError) {
    return ApiResponse.error(res, 400, err.message);
  }

  if (err instanceof AuthError) {
    const statusMap = {
      INVALID_CREDENTIALS: 401,
      ACCOUNT_LOCKED: 423,   // HTTP 423 = Locked
      INVALID_TOKEN: 401,
      SESSION_REVOKED: 401,
      USER_NOT_FOUND: 404,
    };
    const status = statusMap[err.code] || 400;
    return ApiResponse.error(res, status, err.message);
  }

  // Handle PostgreSQL unique constraint violations
  if (err.code === '23505') {
    return ApiResponse.error(res, 409, 'A record with this information already exists.');
  }

  // Generic fallback — NEVER expose internal errors to clients in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  return ApiResponse.error(res, 500, message);
};

module.exports = errorHandler;
