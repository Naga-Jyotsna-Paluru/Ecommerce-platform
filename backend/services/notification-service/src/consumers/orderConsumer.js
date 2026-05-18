/**
 * consumers/orderConsumer.js  (notification-service)
 *
 * WHY A CONSUMER HERE?
 * Payment-service publishes `order.payment.succeeded` events to RabbitMQ.
 * This consumer subscribes to those events and sends confirmation emails.
 *
 * Architecture: payment-service ──► RabbitMQ ──► [this consumer] ──► email
 *
 * WHY THIS IS BETTER THAN DIRECT HTTP CALLS:
 * - Resilience: if notification-service is down, messages queue up and are
 *   processed when it restarts — no emails are lost.
 * - Decoupling: payment-service does not import or know about notification-service.
 * - Scalability: we can run multiple notification-service instances, and
 *   RabbitMQ load-balances messages between them automatically.
 *
 * DELIVERY GUARANTEES:
 * - `durable: true` on the queue → survives broker restart
 * - `persistent: true` on messages → written to disk by RabbitMQ
 * - Manual ack (channel.ack) → message only removed after successful processing
 * - prefetch(1) → process one message at a time per instance (fair dispatch)
 */

const amqp         = require('amqplib');
const emailService = require('../services/emailService');
const logger       = require('../utils/logger');

const RABBITMQ_URL  = process.env.RABBITMQ_URL;
const EXCHANGE      = 'ecommerce.events';
const EXCHANGE_TYPE = 'topic';
const QUEUE         = 'notification.order.payment.succeeded';
const ROUTING_KEY   = 'order.payment.succeeded';
const RECONNECT_MS  = 5_000;

let connection = null;
let channel    = null;

/**
 * Process one `order.payment.succeeded` message.
 * Returns true on success, false on failure (so we can nack if needed).
 */
async function handleMessage(msg) {
  let data;
  try {
    data = JSON.parse(msg.content.toString());
  } catch {
    logger.error('Consumer: malformed message — discarding', { content: msg.content.toString() });
    return false; // bad JSON — no point retrying
  }

  const { orderId, userId, userEmail, totalAmount } = data;
  logger.info('Consumer: processing order.payment.succeeded', { orderId, userId });

  try {
    await emailService.sendOrderConfirmation({
      orderId,
      userId,
      userEmail,
      totalAmount,
    });
    logger.info('Consumer: confirmation email sent', { orderId, userEmail });
    return true;
  } catch (err) {
    logger.error('Consumer: failed to send email', { orderId, error: err.message });
    return false;
  }
}

/**
 * Connect, assert topology, and start consuming.
 * Retries indefinitely if RabbitMQ is not yet ready.
 */
async function start() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel    = await connection.createChannel();

    // One message at a time — prevents overwhelming the email service
    await channel.prefetch(1);

    // Assert exchange (idempotent — safe if already created by payment-service)
    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

    // Assert durable queue — survives broker restart
    await channel.assertQueue(QUEUE, {
      durable:   true,
      arguments: {
        // Dead-letter exchange: undeliverable messages go here for inspection
        'x-dead-letter-exchange': 'ecommerce.dlx',
      },
    });

    // Bind queue to exchange with routing key pattern
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    logger.info('RabbitMQ consumer started', { queue: QUEUE, routingKey: ROUTING_KEY });

    // Start consuming — noAck: false → we manually ack/nack
    channel.consume(QUEUE, async (msg) => {
      if (!msg) return; // null = consumer cancelled by broker

      const ok = await handleMessage(msg);

      if (ok) {
        // Remove from queue — processed successfully
        channel.ack(msg);
      } else {
        // Requeue=false → send to dead-letter queue instead of infinite loop
        channel.nack(msg, false, false);
      }
    }, { noAck: false });

    // Reconnect if connection drops
    connection.on('close', () => {
      logger.warn('Consumer: RabbitMQ connection lost — reconnecting in 5 s');
      connection = null;
      channel    = null;
      setTimeout(start, RECONNECT_MS);
    });

    connection.on('error', (err) => {
      logger.error('Consumer: RabbitMQ connection error', { error: err.message });
    });
  } catch (err) {
    logger.warn('Consumer: RabbitMQ not ready — retrying in 5 s', { error: err.message });
    setTimeout(start, RECONNECT_MS);
  }
}

module.exports = { start };
