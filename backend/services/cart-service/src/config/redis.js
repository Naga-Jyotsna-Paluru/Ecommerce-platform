/**
 * config/redis.js
 *
 * Redis client setup using ioredis — the most full-featured Redis client for Node.js.
 *
 * WHY REDIS FOR CART?
 * - In-memory → microsecond read/write (vs milliseconds for PostgreSQL)
 * - Native TTL support — carts expire automatically, no cleanup job needed
 * - Hash data structure → perfect for {productId: quantity} cart storage
 * - If Redis goes down, cart is lost — acceptable (user just re-adds items)
 *   but order data in PostgreSQL is safe
 *
 * CART DATA STRUCTURE IN REDIS:
 * Key:   cart:{userId}
 * Type:  Hash (Redis Hash — like a JSON object)
 * Value: { productId: JSON.stringify({quantity, productName, price, addedAt}) }
 * TTL:   7 days (reset on every cart interaction)
 *
 * Example:
 *   cart:user-uuid-123 → {
 *     "product-uuid-abc": '{"quantity":2,"productName":"MacBook","price":99999}',
 *     "product-uuid-def": '{"quantity":1,"productName":"Mouse","price":1500}'
 *   }
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // Retry strategy — don't crash on temporary Redis disconnects
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: too many connection retries. Giving up.');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000); // Exponential backoff, max 3s
  },
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis connection established'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

module.exports = redis;
