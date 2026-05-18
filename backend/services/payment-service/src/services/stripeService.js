const Stripe = require('stripe');
const logger = require('../utils/logger');

/**
 * Stripe SDK wrapper.
 *
 * Why a wrapper instead of using stripe directly?
 * - Centralizes all Stripe API calls in one place
 * - Easier to mock in tests
 * - Single place to add retry logic, logging, or swap providers later
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  timeout: 10000, // 10s timeout for Stripe API calls
});

const stripeService = {
  /**
   * Create a PaymentIntent.
   *
   * PaymentIntent lifecycle:
   * requires_payment_method → requires_confirmation → processing → succeeded/failed
   *
   * @param {number} amountCents - Amount in smallest currency unit (paise for INR)
   * @param {string} currency    - ISO 4217 currency code, lowercase ('inr', 'usd')
   * @param {object} metadata    - Arbitrary key-value pairs attached to the intent
   */
  async createPaymentIntent({ amountCents, currency, metadata = {} }) {
    logger.debug('Creating Stripe PaymentIntent', { amountCents, currency });

    const intent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        created_by: 'ecommerce-platform',
      },
    });

    logger.info('Stripe PaymentIntent created', { intentId: intent.id, status: intent.status });
    return intent;
  },

  /**
   * Retrieve a PaymentIntent from Stripe (used for verification).
   */
  async retrievePaymentIntent(paymentIntentId) {
    return stripe.paymentIntents.retrieve(paymentIntentId);
  },

  /**
   * Construct and verify a Stripe webhook event.
   *
   * CRITICAL: We MUST verify the webhook signature before trusting the payload.
   * Without this, anyone could POST a fake "payment.succeeded" to our endpoint
   * and we'd ship the order without receiving money.
   *
   * @param {Buffer} rawBody        - Raw request body (must NOT be JSON-parsed)
   * @param {string} signatureHeader - stripe-signature HTTP header value
   */
  constructWebhookEvent(rawBody, signatureHeader) {
    return stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },

  /**
   * Issue a full refund for a PaymentIntent.
   */
  async refund(paymentIntentId, reason = 'requested_by_customer') {
    logger.info('Issuing Stripe refund', { paymentIntentId, reason });
    return stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason,
    });
  },
};

module.exports = stripeService;
