const { pool } = require('../config/database');

/**
 * PaymentRepository — the ONLY file that writes raw SQL for payments.
 * All methods accept an optional `client` parameter for transaction support.
 */
const paymentRepository = {
  /**
   * Create a new payment record (initially pending, before Stripe is called).
   */
  async create({ orderId, userId, amountCents, currency = 'inr' }, client = pool) {
    const result = await client.query(
      `INSERT INTO payments (order_id, user_id, amount_cents, currency, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [orderId, userId, amountCents, currency]
    );
    return result.rows[0];
  },

  /**
   * Save the Stripe PaymentIntent details after successful Stripe API call.
   */
  async updateStripeIntent({ id, stripePaymentIntentId, stripeClientSecret }, client = pool) {
    const result = await client.query(
      `UPDATE payments
       SET stripe_payment_intent_id = $1,
           stripe_client_secret     = $2,
           status                   = 'requires_payment_method'
       WHERE id = $3
       RETURNING *`,
      [stripePaymentIntentId, stripeClientSecret, id]
    );
    return result.rows[0];
  },

  /**
   * Update payment status — called by webhook handler.
   */
  async updateStatus({ stripePaymentIntentId, status, failureReason = null, metadata = {} }, client = pool) {
    const result = await client.query(
      `UPDATE payments
       SET status         = $1,
           failure_reason = $2,
           metadata       = metadata || $3::jsonb
       WHERE stripe_payment_intent_id = $4
       RETURNING *`,
      [status, failureReason, JSON.stringify(metadata), stripePaymentIntentId]
    );
    return result.rows[0] || null;
  },

  async findByOrderId(orderId, client = pool) {
    const result = await client.query(
      'SELECT * FROM payments WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0] || null;
  },

  async findByStripeIntentId(stripePaymentIntentId, client = pool) {
    const result = await client.query(
      'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
      [stripePaymentIntentId]
    );
    return result.rows[0] || null;
  },

  async findByUserId(userId, client = pool) {
    const result = await client.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  },
};

module.exports = paymentRepository;
