const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');
const ApiResponse = require('./utils/apiResponse');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Orders are write-heavy and sensitive — lower limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service', timestamp: new Date().toISOString() });
});

app.use('/api/orders', orderRoutes);

app.use((req, res) => {
  ApiResponse.error(res, 404, `Route ${req.method} ${req.path} not found`);
});

app.use(errorHandler);

module.exports = app;
