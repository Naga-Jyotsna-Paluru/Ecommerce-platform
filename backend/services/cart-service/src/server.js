require('dotenv').config();
const app = require('./app');
const redis = require('./config/redis');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  try {
    // Verify Redis is reachable before accepting traffic
    await redis.ping();
    logger.info('Redis connection verified');

    const server = app.listen(PORT, () => {
      logger.info(`Cart service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(async () => {
        await redis.quit(); // Gracefully close Redis connection
        logger.info('Redis connection closed. Process exiting.');
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
    logger.error('Failed to start cart service', { error: error.message });
    process.exit(1);
  }
};

startServer();
