const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');
const notificationRoutes = require('./routes/notificationRoutes');
const ApiResponse  = require('./utils/apiResponse');
const logger       = require('./utils/logger');

const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: '50kb' }));

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

  // Routes
  app.use('/api/notifications', notificationRoutes);

  // 404
  app.use((_req, res) => ApiResponse.error(res, { message: 'Route not found', statusCode: 404 }));

  // Global error handler
  app.use((err, req, res, _next) => {
    logger.error('Unhandled error', { message: err.message, path: req.path });
    ApiResponse.error(res, { statusCode: 500 });
  });

  return app;
};

module.exports = createApp;
