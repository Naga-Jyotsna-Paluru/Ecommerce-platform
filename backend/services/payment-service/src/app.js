const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');
const paymentRoutes  = require('./routes/paymentRoutes');
const errorHandler   = require('./middlewares/errorHandler');

const createApp = () => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // Payment endpoints should be low-volume
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
  }));

  // HTTP request logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // ─── IMPORTANT: Webhook route MUST come before express.json() ───────────────
  // Stripe signature verification requires the raw Buffer body.
  // express.json() would parse it into an object, destroying the raw bytes
  // needed for HMAC verification.
  app.use(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' })
  );

  // JSON body parsing for all other routes
  app.use(express.json({ limit: '10kb' }));

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));

  // Routes
  app.use('/api/payments', paymentRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

  // Global error handler
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
