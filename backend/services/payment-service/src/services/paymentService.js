const paymentRepository = require('../repositories/paymentRepository');
const stripeService     = require('./stripeService');
const serviceClients    = require('./serviceClients');
const messageBroker     = require('../utils/messageBroker');
const logger            = require('../utils/logger');

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name  = 'PaymentError';
    this.statusCode = statusCode;
  }
}

/**
 * Convert decimal string (e.g. "999.00") to integer paise/cents.
 * Stripe requires amounts in the smallest currency unit.
 * NEVER use parseFloat directly — floating-point math can lose precision.
 */
const toCents = (decimalString) =>
  Math.round(parseFloat(decimalString) * 100);

const paymentService = {
  /**
   * Create a PaymentIntent for an order.
   *
   * Flow:
   * 1. Check if a payment record already exists for this order (idempotency).
   * 2. Create a DB record with status = 'pending'.
   * 3. Call Stripe to create a PaymentIntent.
   * 4. Update DB record with the Stripe intent ID and client_secret.
   * 5. Return the client_secret to the frontend so it can complete payment.
   *
   * The client_secret is NOT sensitive — it's safe to send to the frontend.
   * The STRIPE_SECRET_KEY is sensitive and must never leave the backend.
   */
  async createPaymentIntent({ orderId, userId, totalAmount, currency = 'inr' }) {
    // Idempotency: if a PaymentIntent was already created for this order, return it
    const existing = await paymentRepository.findByOrderId(orderId);
    if (existing && existing.stripe_payment_intent_id) {
      logger.info('Returning existing PaymentIntent', { orderId });
      return {
        clientSecret: existing.stripe_client_secret,
        paymentId:    existing.id,
      };
    }

    const amountCents = toCents(totalAmount);
    if (amountCents <= 0) {
      throw new PaymentError('Invalid payment amount');
    }

    // Create DB record first — gives us an ID before calling Stripe
    const payment = await paymentRepository.create({ orderId, userId, amountCents, currency });

    try {
      // Create PaymentIntent on Stripe
      const intent = await stripeService.createPaymentIntent({
        amountCents,
        currency,
        metadata: { orderId, userId, paymentId: payment.id },
      });

      // Update DB with Stripe's response
      const updated = await paymentRepository.updateStripeIntent({
        id:                      payment.id,
        stripePaymentIntentId:   intent.id,
        stripeClientSecret:      intent.client_secret,
      });

      return {
        clientSecret: updated.stripe_client_secret,
        paymentId:    updated.id,
      };
    } catch (err) {
      // Mark the payment record as failed in our DB
      await paymentRepository.updateStatus({
        stripePaymentIntentId: null,
        status:                'failed',
        failureReason:         err.message,
        metadata:              { paymentDbId: payment.id },
      }).catch(() => {}); // Best-effort — don't mask original error

      logger.error('Stripe PaymentIntent creation failed', { orderId, error: err.message });
      throw new PaymentError('Payment service unavailable. Please try again.', 503);
    }
  },

  /**
   * Handle a verified Stripe webhook event.
   *
   * This is called ONLY after signature verification in the controller.
   * We handle the events we care about and ignore the rest (Stripe sends many).
   */
  async handleWebhookEvent(event) {
    const { type, data } = event;
    const intent         = data.object;

    logger.info('Processing Stripe webhook event', { type, intentId: intent.id });

    switch (type) {
      case 'payment_intent.succeeded': {
        const payment = await paymentRepository.updateStatus({
          stripePaymentIntentId: intent.id,
          status:                'succeeded',
          metadata:              { stripeEvent: type, chargeId: intent.latest_charge },
        });

        if (payment) {
          // Update order status to 'confirmed' in order-service (synchronous — critical path)
          await serviceClients.updateOrderStatus(payment.order_id, 'confirmed');

          // Publish async event — notification-service will consume and send email.
          // WHY ASYNC? If the notification service is temporarily down, the payment
          // still succeeds and the email is delivered once the consumer recovers.
          await messageBroker.publish('order.payment.succeeded', {
            orderId:     payment.order_id,
            userId:      payment.user_id,
            userEmail:   intent.metadata?.userEmail,
            totalAmount: (payment.amount_cents / 100).toFixed(2),
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const failureMessage = intent.last_payment_error?.message || 'Payment failed';

        const payment = await paymentRepository.updateStatus({
          stripePaymentIntentId: intent.id,
          status:                'failed',
          failureReason:         failureMessage,
          metadata:              { stripeEvent: type },
        });

        if (payment) {
          await serviceClients.updateOrderStatus(payment.order_id, 'cancelled');
        }
        break;
      }

      case 'charge.refunded': {
        const paymentIntentId = intent.payment_intent;
        if (paymentIntentId) {
          await paymentRepository.updateStatus({
            stripePaymentIntentId: paymentIntentId,
            status:                'refunded',
            metadata:              { stripeEvent: type, refundId: intent.id },
          });
        }
        break;
      }

      default:
        logger.debug('Unhandled Stripe event type — ignoring', { type });
    }
  },

  async getPaymentByOrderId(orderId, requestingUserId) {
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw new PaymentError('Payment not found', 404);
    if (payment.user_id !== requestingUserId) throw new PaymentError('Forbidden', 403);
    return payment;
  },
};

module.exports = { paymentService, PaymentError };
