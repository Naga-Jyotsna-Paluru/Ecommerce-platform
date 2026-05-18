/**
 * services/orderService.js
 *
 * This is the most important service in the codebase — it demonstrates:
 *
 * 1. DATABASE TRANSACTIONS — atomicity across multiple tables
 * 2. INTER-SERVICE COMMUNICATION — calling the product service
 * 3. THE SAGA PATTERN (simplified) — compensating actions on failure
 * 4. PRICE SNAPSHOTTING — capture price at order time, not read time
 *
 * TRANSACTION PATTERN:
 * ┌─────────────────────────────────┐
 * │  const client = await pool.connect()  │
 * │  await client.query('BEGIN')          │
 * │  try {                                │
 * │    // all DB writes use `client`      │
 * │    await client.query('COMMIT')       │
 * │  } catch {                            │
 * │    await client.query('ROLLBACK')     │
 * │    throw error                        │
 * │  } finally {                          │
 * │    client.release()  ← ALWAYS        │
 * │  }                                    │
 * └─────────────────────────────────┘
 */

const { pool } = require('../config/database');
const orderRepository = require('../repositories/orderRepository');
const productServiceClient = require('./productServiceClient');
const logger = require('../utils/logger');

class OrderNotFoundError extends Error {
  constructor(id) {
    super(`Order not found: ${id}`);
    this.name = 'OrderNotFoundError';
  }
}

class OrderAuthorizationError extends Error {
  constructor() {
    super('You are not authorized to access this order');
    this.name = 'OrderAuthorizationError';
  }
}

const VALID_STATUS_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped:    ['delivered'],
  delivered:  [], // Terminal state
  cancelled:  [], // Terminal state
  refunded:   [], // Terminal state
};

const orderService = {
  /**
   * Create a new order.
   *
   * This is a multi-step operation that MUST be atomic:
   * Step 1: Validate products & stock (calls product-service)
   * Step 2: Calculate total
   * Step 3: BEGIN transaction
   * Step 4: INSERT order
   * Step 5: INSERT order items (with snapshotted prices)
   * Step 6: Decrement stock on product-service
   * Step 7: COMMIT
   *
   * If step 6 fails, we ROLLBACK steps 4-5 (compensating transaction).
   */
  async createOrder({ userId, items, shippingAddress, notes }, authToken) {
    // --- Step 1: Validate outside transaction (network calls are slow) ---
    const enrichedItems = await productServiceClient.validateAndEnrichCartItems(items);

    // --- Step 2: Calculate total from product service prices (never trust client) ---
    const totalAmount = enrichedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    // --- Steps 3-7: Database transaction ---
    const client = await pool.connect();
    let order;

    try {
      await client.query('BEGIN');

      // Step 4: Create order record
      order = await orderRepository.create(
        { userId, totalAmount: totalAmount.toFixed(2), shippingAddress, notes },
        client
      );

      // Step 5: Create order items with snapshotted prices
      await orderRepository.createItems(order.id, enrichedItems, client);

      // Step 6: Decrement stock — if this fails, the ROLLBACK undoes steps 4-5
      await productServiceClient.decrementStock(enrichedItems, authToken);

      await client.query('COMMIT');

      logger.info('Order created successfully', {
        orderId: order.id,
        userId,
        totalAmount,
        itemCount: enrichedItems.length,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Order creation failed, transaction rolled back', {
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      // CRITICAL: Always release the client back to the pool
      // Forgetting this exhausts the connection pool
      client.release();
    }

    // Fetch the full order with items to return to the client
    return orderRepository.findById(order.id);
  },

  async getOrderById(orderId, requestingUserId, requestingUserRole) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new OrderNotFoundError(orderId);

    // Users can only see their own orders; admins can see all
    if (requestingUserRole !== 'admin' && order.user_id !== requestingUserId) {
      throw new OrderAuthorizationError();
    }

    return order;
  },

  async getUserOrders(userId, pagination) {
    return orderRepository.findByUserId(userId, pagination);
  },

  async getAllOrders(filters) {
    return orderRepository.findAll(filters);
  },

  /**
   * Update order status with lifecycle validation.
   * Prevents illegal transitions (e.g., delivered → pending).
   */
  async updateOrderStatus(orderId, newStatus, adminUserId) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new OrderNotFoundError(orderId);

    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[order.status] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new Error(
        `Cannot transition order from "${order.status}" to "${newStatus}". ` +
        `Allowed transitions: ${allowedNextStatuses.join(', ') || 'none (terminal state)'}`
      );
    }

    const updated = await orderRepository.updateStatus(orderId, newStatus);

    logger.info('Order status updated', { orderId, from: order.status, to: newStatus, by: adminUserId });

    return updated;
  },

  /**
   * Cancel an order (user self-service).
   * Users can only cancel their own pending/confirmed orders.
   */
  async cancelOrder(orderId, userId) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new OrderNotFoundError(orderId);
    if (order.user_id !== userId) throw new OrderAuthorizationError();

    const cancellable = ['pending', 'confirmed'];
    if (!cancellable.includes(order.status)) {
      throw new Error(`Orders in "${order.status}" status cannot be cancelled`);
    }

    return orderRepository.updateStatus(orderId, 'cancelled');
  },
};

module.exports = { orderService, OrderNotFoundError, OrderAuthorizationError };
