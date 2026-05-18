const { PaymentError } = require('../services/paymentService');
const ApiResponse = require('../utils/apiResponse');
const logger      = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
  if (err instanceof PaymentError) {
    return ApiResponse.error(res, { message: err.message, statusCode: err.statusCode });
  }

  logger.error('Unhandled error in payment-service', {
    message: err.message,
    stack:   process.env.NODE_ENV === 'production' ? undefined : err.stack,
    path:    req.path,
  });

  return ApiResponse.error(res, {
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    statusCode: err.statusCode || 500,
  });
};

module.exports = errorHandler;
