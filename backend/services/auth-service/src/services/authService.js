/**
 * services/authService.js
 *
 * The Service Layer: This is where ALL business logic lives.
 *
 * RESPONSIBILITY:
 * - Orchestrate calls to the repository
 * - Apply business rules (is this email taken? is the account locked?)
 * - Handle password hashing and JWT creation
 * - Throw domain-specific errors (not HTTP errors — that's the controller's job)
 *
 * The service layer does NOT know about HTTP (no req, res, status codes).
 * This makes it reusable — you could call it from a REST API, a GraphQL
 * resolver, a CLI script, or a test.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

// Custom error classes — lets the controller distinguish error types
class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code; // e.g. 'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED'
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// --- Token Utilities ---

/**
 * Generate a short-lived access token (15 minutes).
 * This is sent with every API request in the Authorization header.
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { sub: userId, role }, // 'sub' (subject) is the JWT standard claim for user ID
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate a long-lived refresh token (7 days).
 * Used ONLY to get a new access token. Stored as an HttpOnly cookie.
 *
 * We hash the refresh token before storing in DB.
 * If the DB is breached, attackers get hashes, not the real tokens.
 */
const generateRefreshToken = (userId) => {
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return token;
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// --- Auth Service Methods ---

const authService = {
  /**
   * Register a new user.
   *
   * Flow:
   * 1. Check if email is already taken
   * 2. Hash the password (NEVER store plaintext)
   * 3. Create the user record
   * 4. Return user data (no tokens — user must verify email first in full flow)
   */
  async register({ email, password, fullName }) {
    // Check for existing user BEFORE hashing — hashing is expensive (by design)
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ValidationError('An account with this email already exists');
    }

    // bcrypt cost factor of 12 is the industry standard balance of security vs speed
    // Factor 10 = ~100ms per hash, Factor 12 = ~400ms — acceptable for registration
    // Factor 14+ = too slow for login on low-end servers
    const SALT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userRepository.create({ email, passwordHash, fullName });

    logger.info('New user registered', { userId: user.id, email: user.email });

    return user;
  },

  /**
   * Authenticate a user and issue tokens.
   *
   * Flow:
   * 1. Find user by email
   * 2. Check account lock status
   * 3. Compare password with stored hash
   * 4. Generate access + refresh tokens
   * 5. Store hashed refresh token in DB
   */
  async login({ email, password }) {
    // We need the full user record including password_hash
    const user = await userRepository.findByEmail(email);

    // IMPORTANT: Use a generic error message — never tell the attacker
    // which part was wrong (email vs password). That helps enumeration attacks.
    if (!user) {
      // Intentional constant-time response to prevent timing attacks
      await bcrypt.compare(password, '$2b$12$invalidhashtopreventtimingattack00000000000000000000000');
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check if account is temporarily locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AuthError(
        `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`,
        'ACCOUNT_LOCKED'
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Track failed attempts for brute-force protection
      await userRepository.incrementFailedLoginAttempts(user.id);
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Successful login — reset failure counter
    await userRepository.resetFailedLoginAttempts(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Store hashed refresh token — if our DB leaks, tokens remain safe
    await userRepository.updateRefreshToken(user.id, hashToken(refreshToken));

    logger.info('User logged in', { userId: user.id });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isVerified: user.is_verified,
      },
    };
  },

  /**
   * Refresh an expired access token using a valid refresh token.
   *
   * Flow:
   * 1. Verify JWT signature
   * 2. Fetch user from DB, check if refresh token hash matches stored hash
   * 3. Issue new access token (and optionally rotate refresh token)
   */
  async refreshTokens(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AuthError('Invalid or expired refresh token', 'INVALID_TOKEN');
    }

    const user = await userRepository.findById(decoded.sub);
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    // Re-fetch full user to get refresh_token_hash
    const fullUser = await userRepository.findByEmail(user.email);
    if (!fullUser || !fullUser.refresh_token_hash) {
      throw new AuthError('Session has been revoked', 'SESSION_REVOKED');
    }

    // Validate that the provided token matches what we stored
    if (fullUser.refresh_token_hash !== hashToken(refreshToken)) {
      throw new AuthError('Invalid refresh token', 'INVALID_TOKEN');
    }

    // Rotate refresh token (best practice — limits window if a token is stolen)
    const newAccessToken = generateAccessToken(fullUser.id, fullUser.role);
    const newRefreshToken = generateRefreshToken(fullUser.id);
    await userRepository.updateRefreshToken(fullUser.id, hashToken(newRefreshToken));

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  /**
   * Log out a user by revoking their refresh token.
   * On next request with the old refresh token, it will be rejected.
   */
  async logout(userId) {
    await userRepository.updateRefreshToken(userId, null);
    logger.info('User logged out', { userId });
  },
};

module.exports = { authService, AuthError, ValidationError };
