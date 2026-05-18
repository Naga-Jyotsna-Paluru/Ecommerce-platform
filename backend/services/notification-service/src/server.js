require('dotenv').config();
const createApp   = require('./app');
const emailService = require('./services/emailService');
const logger      = require('./utils/logger');

const PORT = process.env.PORT || 3006;

const startServer = async () => {
  try {
    // Verify SMTP connectivity before accepting traffic
    await emailService.verify();

    const app = createApp();
    const server = app.listen(PORT, () => {
      logger.info(`Notification service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(() => {
        logger.info('Notification service stopped.');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start notification service', { error: error.message });
    process.exit(1);
  }
};

startServer();
