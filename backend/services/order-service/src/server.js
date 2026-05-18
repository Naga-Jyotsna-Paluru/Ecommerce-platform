require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/database');
const { createOrderTables } = require('./models/orderModel');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  try {
    await testConnection();
    await createOrderTables();

    const server = app.listen(PORT, () => {
      logger.info(`Order service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      server.close(() => { logger.info('HTTP server closed.'); process.exit(0); });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection', { reason });
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
