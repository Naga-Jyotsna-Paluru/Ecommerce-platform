/**
 * server.js
 *
 * Application entry point.
 *
 * This file is responsible for:
 * 1. Loading environment variables
 * 2. Testing the database connection
 * 3. Running database migrations
 * 4. Starting the HTTP server
 *
 * It imports the configured app from app.js — keeping startup logic separate
 * from application configuration.
 */

// Load .env variables FIRST before importing anything else
// (other modules read process.env at import time)
require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/database');
const { createUsersTable } = require('./models/userModel');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // 1. Verify database is reachable
    await testConnection();

    // 2. Ensure tables exist (run migrations)
    await createUsersTable();

    // 3. Start listening
    const server = app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // --- Graceful Shutdown ---
    // When the container/process receives SIGTERM (e.g. from Docker stop),
    // finish in-progress requests before closing the server.
    // Without this, active requests get cut off — bad for users.
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      server.close(() => {
        logger.info('HTTP server closed. Process exiting.');
        process.exit(0);
      });

      // Force shutdown after 30 seconds if graceful close hangs
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

    // Catch unhandled promise rejections — log and exit (let process manager restart)
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
