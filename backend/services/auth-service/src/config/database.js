/**
 * config/database.js
 *
 * Creates and exports a PostgreSQL connection pool.
 *
 * WHY A POOL?
 * Creating a new DB connection for every request is expensive (TCP handshake,
 * auth, etc.). A pool maintains a set of open connections and reuses them.
 * pg.Pool handles this automatically — this is production standard.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// pg reads these environment variables automatically, but we're explicit here
// so any developer can see exactly what config is expected
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  max: 20,            // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Throw error if connection takes > 2s
});

// Log whenever a new client connects — useful for debugging pool exhaustion
pool.on('connect', () => {
  logger.debug('New database client connected');
});

// This fires when a client throws an error while sitting idle in the pool
// Without this handler, the error would be an unhandled exception and crash the server
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
  process.exit(1); // Crash fast — better than silent corruption
});

/**
 * Test the database connection at startup.
 * Calling this on boot gives immediate feedback if the DB is unreachable,
 * rather than failing silently on the first request.
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection established successfully');
    client.release(); // Always release back to the pool
  } catch (error) {
    logger.error('Failed to connect to the database', { error: error.message });
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
