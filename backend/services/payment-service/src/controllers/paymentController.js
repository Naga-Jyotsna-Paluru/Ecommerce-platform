const { paymentService, PaymentError } = require('../services/paymentService');
const stripeService = require('../services/stripeService');
const ApiResponse   = require('../utils/apiResponse');
const logger        = require('../utils/logger');

const paymentController = {
  /**
   * POST /api/payments/create-intent
   *
   * Called by the frontend checkout page after the order is created.
   * Returns a client_secret that the frontend passes to Stripe.js to
   * render the payment form and complete the transaction client-side.
   */
  async createIntent(req, res, next) {
    try {
      const { orderId, totalAmount, currency } = req.body;
      const userId = req.user.id;

      const result = await paymentService.createPaymentIntent({
        orderId,
        userId,
        totalAmount,
        currency: currency || 'inr',
      });

      ApiResponse.success(res, {
        message: 'PaymentIntent created',
        data: {
          clientSecret: result.clientSecret,
          paymentId:    result.paymentId,
        },
        statusCode: 201,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/webhook
   *
   * Stripe calls this endpoint when a payment event occurs.
   *
   * CRITICAL rules for webhook endpoints:
   * 1. The raw request body must be passed to constructEvent — NOT the parsed JSON.
   *    This is why this route uses express.raw() middleware, NOT express.json().
   * 2. Always return HTTP 200 quickly. If we return 4xx/5xx, Stripe will retry.
   * 3. Signature verification must happen BEFORE any business logic.
   */
  async handleWebhook(req, res) {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event;
    try {
      // req.body is a raw Buffer here (set up in app.js for this route)
      event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (err) {
      logger.warn('Webhook signature verification failed', { error: err.message });
      // Return 400 to tell Stripe the payload was invalid
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Process asynchronously — we want to return 200 to Stripe immediately
    // and handle the event in the background to avoid Stripe timeout retries
    res.status(200).json({ received: true });

    // Process after sending response
    paymentService.handleWebhookEvent(event).catch((err) => {
      logger.error('Webhook event processing failed', { eventId: event.id, error: err.message });
    });
  },

  /**
   * GET /api/payments/order/:orderId
   * Get payment status for an order (user's own orders only).
   */
  async getPaymentByOrder(req, res, next) {
    try {
      const payment = await paymentService.getPaymentByOrderId(
        req.params.orderId,
        req.user.id
      );
      ApiResponse.success(res, { data: payment });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = paymentController;
