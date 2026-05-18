const axios = require('axios');
const logger = require('../utils/logger');

/**
 * HTTP client for calling order-service internal APIs.
 * Used to update order status after Stripe webhook events.
 */
const orderClient = axios.create({
  baseURL: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  timeout: 5000,
});

/**
 * HTTP client for calling notification-service.
 */
const notificationClient = axios.create({
  baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
  timeout: 5000,
});

const serviceClients = {
  /**
   * Tell the order-service to update an order's status.
   * Called after payment.succeeded or payment_intent.payment_failed.
   *
   * We use a service-to-service shared secret here instead of a user JWT
   * because this call originates from a Stripe webhook, not a user session.
   */
  async updateOrderStatus(orderId, status) {
    try {
      await orderClient.patch(
        `/api/orders/internal/${orderId}/status`,
        { status },
        {
          headers: {
            'x-service-secret': process.env.SERVICE_SECRET || 'dev_service_secret',
          },
        }
      );
      logger.info('Order status updated via inter-service call', { orderId, status });
    } catch (err) {
      // Log but don't throw — webhook handler must return 200 to Stripe
      // even if order-service is temporarily unavailable.
      // A dead-letter queue or retry mechanism would handle this in production.
      logger.error('Failed to update order status', {
        orderId,
        status,
        error: err.message,
      });
    }
  },

  /**
   * Trigger an order confirmation email via notification-service.
   */
  async sendOrderConfirmation({ orderId, userId, userEmail, totalAmount }) {
    try {
      await notificationClient.post('/api/notifications/order-confirmation', {
        orderId,
        userId,
        userEmail,
        totalAmount,
      }, {
        headers: {
          'x-service-secret': process.env.SERVICE_SECRET || 'dev_service_secret',
        },
      });
      logger.info('Order confirmation notification triggered', { orderId });
    } catch (err) {
      logger.error('Failed to trigger order confirmation notification', {
        orderId,
        error: err.message,
      });
    }
  },
};

module.exports = serviceClients;
