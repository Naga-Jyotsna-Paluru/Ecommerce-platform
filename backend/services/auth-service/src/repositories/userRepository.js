/**
 * repositories/userRepository.js
 *
 * The Repository Pattern: This layer is ONLY responsible for database operations.
 * It has zero business logic.
 *
 * WHY THIS PATTERN?
 * - The service layer doesn't care HOW data is fetched, only that it is
 * - If we switch from PostgreSQL to MongoDB, we only change this file
 * - Easier to mock in tests (inject a fake repository)
 * - SQL is never scattered across your codebase
 *
 * RULE: No business logic here. No password hashing. No JWT. Only DB queries.
 */

const { pool } = require('../config/database');

const userRepository = {
  /**
   * Find a user by their email address.
   * Used during login to fetch the user for password comparison.
   */
  async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()] // Normalize email to prevent duplicate accounts
    );
    return result.rows[0] || null; // Return null instead of undefined — more explicit
  },

  /**
   * Find a user by their UUID.
   * Used when validating a JWT to fetch the current user's profile.
   */
  async findById(id) {
    const result = await pool.query(
      // NEVER select password_hash when you don't need it — minimize exposure
      `SELECT id, email, full_name, role, is_verified, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new user record.
   * Returns only safe fields — never the password hash.
   */
  async create({ email, passwordHash, fullName, role = 'customer' }) {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_verified, created_at`,
      [email.toLowerCase().trim(), passwordHash, fullName, role]
    );
    return result.rows[0];
  },

  /**
   * Store the hashed refresh token so we can validate and revoke sessions.
   * Set to NULL to log a user out from a specific device.
   */
  async updateRefreshToken(userId, refreshTokenHash) {
    await pool.query(
      'UPDATE users SET refresh_token_hash = $1 WHERE id = $2',
      [refreshTokenHash, userId]
    );
  },

  /**
   * Record a failed login attempt. If threshold is reached, lock the account.
   * This prevents brute-force attacks on user passwords.
   */
  async incrementFailedLoginAttempts(userId) {
    await pool.query(
      `UPDATE users
       SET
         failed_login_attempts = failed_login_attempts + 1,
         -- Lock account for 15 minutes after 5 failed attempts
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 5
           THEN NOW() + INTERVAL '15 minutes'
           ELSE locked_until
         END
       WHERE id = $1`,
      [userId]
    );
  },

  /**
   * Reset failed attempts after a successful login.
   */
  async resetFailedLoginAttempts(userId) {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL
       WHERE id = $1`,
      [userId]
    );
  },
};

module.exports = userRepository;
