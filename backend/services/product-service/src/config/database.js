/**
 * config/database.js — Product Service
 * Same connection pool pattern as auth-service.
 * Each service owns its own pool connecting to its own database.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
  process.exit(1);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection established successfully');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to the database', { error: error.message });
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
