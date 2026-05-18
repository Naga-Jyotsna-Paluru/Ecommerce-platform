require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cartRoutes = require('./routes/cartRoutes');
const logger = require('./utils/logger');
const ApiResponse = require('./utils/apiResponse');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'cart-service', timestamp: new Date().toISOString() }));
app.use('/api/cart', cartRoutes);
app.use((req, res) => ApiResponse.error(res, 404, `Route ${req.method} ${req.path} not found`));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Cart service error', { error: err.message });
  const msg = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
  ApiResponse.error(res, 500, msg);
});

module.exports = app;
