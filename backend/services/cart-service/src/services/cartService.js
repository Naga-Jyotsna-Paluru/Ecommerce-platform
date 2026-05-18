/**
 * services/cartService.js
 *
 * All cart operations are Redis Hash operations.
 *
 * Redis commands used:
 * - HSET   → set a field in a hash (add/update item)
 * - HGET   → get one field (get single item)
 * - HGETALL→ get entire hash (get cart)
 * - HDEL   → delete a field (remove item)
 * - DEL    → delete entire key (clear cart)
 * - EXPIRE → set/reset TTL
 *
 * All operations reset the TTL — activity extends the cart lifetime.
 */

const redis = require('../config/redis');
const logger = require('../utils/logger');

const CART_TTL = parseInt(process.env.CART_TTL_SECONDS, 10) || 604800; // 7 days

const cartKey = (userId) => `cart:${userId}`;

const cartService = {
  /**
   * Get the full cart for a user.
   * Returns an array of cart item objects, empty array if no cart exists.
   */
  async getCart(userId) {
    const key = cartKey(userId);
    const hash = await redis.hgetall(key);

    if (!hash) return { items: [], totalItems: 0, totalPrice: 0 };

    const items = Object.entries(hash).map(([productId, rawValue]) => ({
      productId,
      ...JSON.parse(rawValue),
    }));

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return { items, totalItems, totalPrice: parseFloat(totalPrice.toFixed(2)) };
  },

  /**
   * Add an item to the cart, or update quantity if it already exists.
   *
   * If the same product is added twice, quantities ADD together.
   * Example: Cart has productA qty=2, add productA qty=1 → qty=3
   */
  async addItem(userId, { productId, productName, price, quantity }) {
    const key = cartKey(userId);

    // Check if item already exists in cart
    const existing = await redis.hget(key, productId);

    let newQuantity = quantity;
    if (existing) {
      const existingItem = JSON.parse(existing);
      newQuantity = existingItem.quantity + quantity;
    }

    const itemData = JSON.stringify({
      productName,
      price: parseFloat(price),
      quantity: newQuantity,
      addedAt: new Date().toISOString(),
    });

    // HSET sets a field in the hash, EXPIRE resets the TTL
    await redis.hset(key, productId, itemData);
    await redis.expire(key, CART_TTL);

    logger.debug('Cart item added/updated', { userId, productId, newQuantity });

    return this.getCart(userId);
  },

  /**
   * Update the quantity of a specific item.
   * If quantity is set to 0, the item is removed.
   */
  async updateItemQuantity(userId, productId, quantity) {
    const key = cartKey(userId);

    if (quantity <= 0) {
      return this.removeItem(userId, productId);
    }

    const existing = await redis.hget(key, productId);
    if (!existing) {
      throw new Error('Item not found in cart');
    }

    const item = JSON.parse(existing);
    item.quantity = quantity;

    await redis.hset(key, productId, JSON.stringify(item));
    await redis.expire(key, CART_TTL);

    return this.getCart(userId);
  },

  /**
   * Remove a single item from the cart.
   */
  async removeItem(userId, productId) {
    const key = cartKey(userId);
    await redis.hdel(key, productId);
    await redis.expire(key, CART_TTL);

    logger.debug('Cart item removed', { userId, productId });

    return this.getCart(userId);
  },

  /**
   * Clear the entire cart — called after a successful order is placed.
   */
  async clearCart(userId) {
    await redis.del(cartKey(userId));
    logger.debug('Cart cleared', { userId });
  },
};

module.exports = cartService;
