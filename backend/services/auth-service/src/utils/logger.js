/**
 * utils/logger.js
 *
 * Centralized application logger using Winston.
 *
 * WHY NOT console.log()?
 * - console.log has no log levels (error vs debug vs info)
 * - No timestamps or structured output
 * - Cannot pipe to log aggregators (Datadog, CloudWatch) easily
 * - Winston is the industry standard for Node.js logging
 *
 * LOG LEVELS (low to high severity):
 *   error > warn > info > http > debug
 * In production, only logs at 'warn' and above are emitted.
 */

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, colorize, errors } = format;

// Custom format: "2026-01-01 12:00:00 [INFO]: message"
const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }), // Include stack traces for Error objects
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  })
);

// In production, output JSON — log aggregators (Splunk, Datadog) parse JSON
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [
    new transports.Console(),
  ],
  // Don't crash the server if logging fails
  exitOnError: false,
});

module.exports = logger;
