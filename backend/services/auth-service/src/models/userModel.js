/**
 * models/userModel.js
 *
 * Handles database schema creation (migration) for the users table.
 *
 * NOTE: In Phase 5, we'll replace this with a proper migration tool
 * (like db-migrate or Flyway). For now, this teaches you what migrations
 * are doing under the hood.
 *
 * SECURITY DECISIONS:
 * - We store password_hash, NEVER plaintext passwords
 * - UUID as primary key (not serial integer) — hides user count, harder to enumerate
 * - refresh_token_hash stored so we can invalidate specific sessions
 * - is_verified for email verification flow
 * - failed_login_attempts + locked_until for brute-force protection
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email                 VARCHAR(255) NOT NULL UNIQUE,
      password_hash         VARCHAR(255) NOT NULL,
      full_name             VARCHAR(255) NOT NULL,
      role                  VARCHAR(20) NOT NULL DEFAULT 'customer'
                            CHECK (role IN ('customer', 'admin', 'vendor')),
      is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
      refresh_token_hash    VARCHAR(255),
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until          TIMESTAMP WITH TIME ZONE,
      created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Index on email for fast login lookups
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Automatically update updated_at on every row modification
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;

    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    await pool.query(query);
    logger.info('Users table is ready');
  } catch (error) {
    logger.error('Failed to create users table', { error: error.message });
    throw error;
  }
};

module.exports = { createUsersTable };
