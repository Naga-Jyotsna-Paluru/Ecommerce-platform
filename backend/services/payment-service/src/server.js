require('dotenv').config();
const createApp = require('./app');
const { testConnection } = require('./config/database');
const { createPaymentsTable } = require('./models/paymentModel');
const messageBroker = require('./utils/messageBroker');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  try {
    await testConnection();
    await createPaymentsTable();
    logger.info('Database schema ready');

    // Connect to RabbitMQ (non-blocking — retries in background if not ready yet)
    messageBroker.connect();

    const app = createApp();
    const server = app.listen(PORT, () => {
      logger.info(`Payment service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(() => {
        logger.info('Payment service stopped.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection', { reason });
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start payment service', { error: error.message });
    process.exit(1);
  }
};

startServer();
