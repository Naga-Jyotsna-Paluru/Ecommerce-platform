/**
 * app.js
 *
 * Express application factory.
 * This file configures and returns the Express app without starting the server.
 *
 * WHY SEPARATE app.js FROM server.js?
 * Separating the app config from the server start allows us to import the app
 * in tests without actually binding to a port. This is essential for
 * integration tests using Supertest.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');
const ApiResponse = require('./utils/apiResponse');

const app = express();

// --- Security Middleware ---

// Helmet sets secure HTTP headers automatically.
// Protects against: clickjacking, XSS, MIME sniffing, etc.
app.use(helmet());

// CORS — only allow requests from our frontend origin
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true, // Required for cookies to be sent cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — prevent brute-force and DDoS attacks
// Auth endpoints get stricter limits (defined in routes optionally)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use(limiter);

// --- General Middleware ---

// Parse JSON request bodies — max 10kb prevents JSON bomb attacks
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Parse cookies (needed for refresh token extraction)
app.use(cookieParser());

// HTTP request logging — use 'combined' format in production for log aggregators
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

// --- Routes ---

// Health check — used by Docker/Kubernetes to know if the service is alive
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);

// 404 handler — must come after all routes
app.use((req, res) => {
  ApiResponse.error(res, 404, `Route ${req.method} ${req.path} not found`);
});

// Global error handler — must be LAST and must have 4 parameters (err, req, res, next)
app.use(errorHandler);

module.exports = app;
