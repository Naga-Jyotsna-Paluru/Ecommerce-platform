/**
 * models/orderModel.js
 *
 * Orders and order_items schema.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. ORDER STATUS AS ENUM-LIKE CHECK CONSTRAINT
 *    The full order lifecycle: pending → confirmed → processing → shipped → delivered
 *    Or: pending → cancelled / failed
 *
 * 2. STORING UNIT PRICE ON ORDER ITEM (not just referencing product price)
 *    If you only store product_id and fetch price at read time, a price change
 *    in the product catalog retroactively changes historical order totals. That's wrong.
 *    We snapshot the price at the time of purchase.
 *
 * 3. SHIPPING ADDRESS AS JSONB
 *    Addresses change over time. Storing a snapshot prevents old orders from
 *    showing a customer's current address (which may have changed since the order).
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

const createOrderTables = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS orders (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL,
      status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
      total_amount     DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
      shipping_address JSONB NOT NULL,
      notes            TEXT,
      stripe_payment_intent_id VARCHAR(255),
      created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  UUID NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity    INT NOT NULL CHECK (quantity > 0),
      unit_price  DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
      total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `;

  try {
    await pool.query(query);
    logger.info('Order tables are ready');
  } catch (error) {
    logger.error('Failed to create order tables', { error: error.message });
    throw error;
  }
};

module.exports = { createOrderTables };
