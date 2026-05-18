/**
 * repositories/orderRepository.js
 *
 * KEY PATTERN: Transaction-aware methods accept an optional `client` parameter.
 *
 * WHY?
 * When creating an order, we run multiple queries that must be atomic.
 * We pass the same pg Client (with an open transaction) to each repository call.
 * If any call fails, we ROLLBACK the entire transaction in the service layer.
 *
 * Methods called WITHOUT a client use the pool (auto-commit, for reads).
 * Methods called WITH a client participate in the caller's transaction.
 */

const { pool } = require('../config/database');

const orderRepository = {
  /**
   * Create an order record.
   * Always called inside a transaction (client is required).
   */
  async create({ userId, totalAmount, shippingAddress, notes }, client) {
    const db = client || pool;
    const result = await db.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, totalAmount, JSON.stringify(shippingAddress), notes || null]
    );
    return result.rows[0];
  },

  /**
   * Bulk insert all order items in a single query.
   * Much faster than inserting one by one.
   * Always called inside a transaction.
   */
  async createItems(orderId, items, client) {
    const db = client || pool;

    // Build a multi-row INSERT: ($1,$2,$3,$4), ($5,$6,$7,$8), ...
    const values = [];
    const placeholders = items.map((item, i) => {
      const base = i * 4;
      values.push(orderId, item.productId, item.productName, item.quantity, item.unitPrice);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    const result = await db.query(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );
    return result.rows;
  },

  /**
   * Update order status — used throughout the order lifecycle.
   * Also stores Stripe payment intent ID when payment is initiated.
   */
  async updateStatus(orderId, status, stripePaymentIntentId = null) {
    const result = await pool.query(
      `UPDATE orders
       SET status = $2,
           stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, status, stripePaymentIntentId]
    );
    return result.rows[0] || null;
  },

  /**
   * Fetch orders for a specific user with pagination.
   * Includes items via a JOIN to avoid N+1 queries.
   */
  async findByUserId(userId, { page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
         o.id, o.status, o.total_amount, o.shipping_address, o.created_at,
         json_agg(json_build_object(
           'id',           oi.id,
           'productId',    oi.product_id,
           'productName',  oi.product_name,
           'quantity',     oi.quantity,
           'unitPrice',    oi.unit_price,
           'totalPrice',   oi.total_price
         )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId]
    );

    return {
      orders: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },

  async findById(orderId) {
    const result = await pool.query(
      `SELECT
         o.*,
         json_agg(json_build_object(
           'id',           oi.id,
           'productId',    oi.product_id,
           'productName',  oi.product_name,
           'quantity',     oi.quantity,
           'unitPrice',    oi.unit_price,
           'totalPrice',   oi.total_price
         )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );
    return result.rows[0] || null;
  },

  // Admin: get all orders with filters
  async findAll({ page = 1, limit = 20, status }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT o.id, o.user_id, o.status, o.total_amount, o.created_at
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return result.rows;
  },
};

module.exports = orderRepository;
