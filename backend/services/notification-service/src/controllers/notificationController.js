const emailService = require('../services/emailService');
const ApiResponse  = require('../utils/apiResponse');
const logger       = require('../utils/logger');

/**
 * Service-to-service authentication middleware.
 *
 * Notification endpoints are internal — they should ONLY be callable by
 * other backend services, never directly by users.
 * We use a shared secret header instead of JWT (no user session involved).
 */
const requireServiceSecret = (req, res, next) => {
  const secret = req.headers['x-service-secret'];
  if (!secret || secret !== process.env.SERVICE_SECRET) {
    logger.warn('Unauthorized notification request', { ip: req.ip, path: req.path });
    return ApiResponse.error(res, { message: 'Unauthorized', statusCode: 401 });
  }
  next();
};

const notificationController = {
  /**
   * POST /api/notifications/order-confirmation
   * Called by payment-service after a successful payment.
   */
  async sendOrderConfirmation(req, res) {
    try {
      const { orderId, userEmail, totalAmount, items } = req.body;

      await emailService.sendOrderConfirmation({
        to:          userEmail,
        orderId,
        totalAmount,
        items:       items || [],
      });

      ApiResponse.success(res, { message: 'Order confirmation email queued' });
    } catch (err) {
      logger.error('Failed to send order confirmation', {
        orderId: req.body?.orderId,
        error:   err.message,
      });
      // Return 200 anyway — the calling service (payment-service) already
      // returned 200 to Stripe and should not be blocked by email failures.
      ApiResponse.success(res, { message: 'Notification accepted (email may be delayed)' });
    }
  },
};

module.exports = { notificationController, requireServiceSecret };
