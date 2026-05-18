const { pool } = require('../config/database');

/**
 * SQL schema for the payments table.
 *
 * Design decisions:
 * - One payment record per order (1:1 relationship)
 * - stripe_payment_intent_id is the external ID we use to reconcile with Stripe
 * - amount_cents stored as INTEGER — avoids floating-point issues entirely
 *   (we multiply by 100 before storing, divide by 100 to display)
 * - metadata JSONB — stores the raw Stripe event payload for audit trail
 * - status mirrors Stripe's PaymentIntent statuses plus our own lifecycle values
 */
const createPaymentsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id                UUID NOT NULL UNIQUE,
      user_id                 UUID NOT NULL,
      stripe_payment_intent_id VARCHAR(255) UNIQUE,
      amount_cents            INTEGER NOT NULL CHECK (amount_cents > 0),
      currency                VARCHAR(3) NOT NULL DEFAULT 'inr',
      status                  VARCHAR(50) NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending',
                                'requires_payment_method',
                                'requires_confirmation',
                                'processing',
                                'succeeded',
                                'failed',
                                'cancelled',
                                'refunded'
                              )),
      stripe_client_secret    TEXT,
      failure_reason          TEXT,
      metadata                JSONB DEFAULT '{}',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Auto-update updated_at on any row change
    CREATE OR REPLACE FUNCTION update_payments_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS payments_updated_at ON payments;
    CREATE TRIGGER payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

    -- Index for webhook lookups by Stripe PaymentIntent ID
    CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments (stripe_payment_intent_id);
    -- Index for fetching user's payment history
    CREATE INDEX IF NOT EXISTS idx_payments_user_id   ON payments (user_id);
  `);
};

module.exports = { createPaymentsTable };
