/**
 * middlewares/errorHandler.js — Product Service
 */
const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { ProductNotFoundError } = require('../services/productService');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  if (err instanceof ProductNotFoundError) {
    return ApiResponse.error(res, 404, err.message);
  }

  if (err.code === '23505') {
    return ApiResponse.error(res, 409, 'A record with this information already exists.');
  }

  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  return ApiResponse.error(res, 500, message);
};

module.exports = errorHandler;
