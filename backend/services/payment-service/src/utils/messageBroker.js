/**
 * utils/messageBroker.js  (payment-service)
 *
 * WHY A PERSISTENT CONNECTION?
 * Opening a new AMQP connection per message is expensive (~20 ms handshake).
 * We keep one connection + one channel alive for the lifetime of the process,
 * and reconnect automatically if the broker restarts.
 *
 * WHY TOPIC EXCHANGE?
 * Topic exchanges route by pattern (e.g. "order.*" matches any order event).
 * This lets us add new event types without changing consumer bindings.
 *
 * EXCHANGE : ecommerce.events  (topic, durable)
 * ROUTING  : order.payment.succeeded
 */

const amqp   = require('amqplib');
const logger = require('./logger');

const EXCHANGE      = 'ecommerce.events';
const EXCHANGE_TYPE = 'topic';
const RECONNECT_MS  = 5_000;

let connection = null;
let channel    = null;

/**
 * Connect to RabbitMQ and assert the exchange.
 * Called once on startup; retries indefinitely until the broker is ready.
 */
async function connect() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel    = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

    logger.info('RabbitMQ connected', { exchange: EXCHANGE });

    // On unexpected close, try to reconnect
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — reconnecting in 5 s');
      connection = null;
      channel    = null;
      setTimeout(connect, RECONNECT_MS);
    });

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
    });
  } catch (err) {
    logger.warn('RabbitMQ not ready — retrying in 5 s', { error: err.message });
    setTimeout(connect, RECONNECT_MS);
  }
}

/**
 * Publish a message to the exchange with the given routing key.
 * Safe to call even if the broker is temporarily unavailable —
 * it logs a warning but does NOT throw (payment flow must continue).
 *
 * Messages are marked `persistent: true` so they survive broker restarts.
 */
async function publish(routingKey, payload) {
  if (!channel) {
    logger.warn('RabbitMQ channel not ready — skipping publish', { routingKey });
    return false;
  }

  try {
    const content = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, routingKey, content, { persistent: true });
    logger.info('Event published', { routingKey, payload });
    return true;
  } catch (err) {
    logger.error('Failed to publish event', { routingKey, error: err.message });
    return false;
  }
}

module.exports = { connect, publish, EXCHANGE };
