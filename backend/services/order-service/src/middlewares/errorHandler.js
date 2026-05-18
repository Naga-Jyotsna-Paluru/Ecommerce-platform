const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { OrderNotFoundError, OrderAuthorizationError } = require('../services/orderService');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  if (err instanceof OrderNotFoundError)      return ApiResponse.error(res, 404, err.message);
  if (err instanceof OrderAuthorizationError) return ApiResponse.error(res, 403, err.message);

  // Business rule violations (e.g., invalid status transition, cancellation window)
  if (err.message && !err.stack?.includes('node_modules')) {
    return ApiResponse.error(res, 400, err.message);
  }

  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  return ApiResponse.error(res, 500, message);
};

module.exports = errorHandler;
