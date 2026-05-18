/**
 * controllers/authController.js
 *
 * The Controller Layer: Handles HTTP concerns ONLY.
 *
 * RESPONSIBILITY:
 * - Parse request body / params / cookies
 * - Call the service layer
 * - Format and send the HTTP response
 * - Set/clear cookies
 *
 * The controller contains ZERO business logic.
 * It's a thin layer between HTTP and the service.
 *
 * REFRESH TOKEN AS HTTPONLY COOKIE — WHY?
 * If you store the refresh token in localStorage, XSS attacks can steal it.
 * HttpOnly cookies cannot be accessed by JavaScript at all.
 * This is the recommended OWASP approach for token storage.
 */

const { authService } = require('../services/authService');
const ApiResponse = require('../utils/apiResponse');

// Shared cookie options for the refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,        // Not accessible via document.cookie (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  // In production the frontend (Vercel) and backend (Railway) are on different
  // domains, so 'strict' blocks the cookie entirely. 'none' + secure=true
  // allows cross-origin cookies (requires HTTPS, which Railway provides).
  // In development both run on localhost so 'lax' is safe and sufficient.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/api/auth',     // Cookie is only sent to auth routes
};

const authController = {
  /**
   * POST /api/auth/register
   * Body: { email, password, fullName }
   */
  async register(req, res, next) {
    try {
      const { email, password, fullName } = req.body;
      const user = await authService.register({ email, password, fullName });
      return ApiResponse.success(res, 201, 'Registration successful. Please verify your email.', { user });
    } catch (error) {
      next(error); // Pass to global error handler
    }
  },

  /**
   * POST /api/auth/login
   * Body: { email, password }
   *
   * Returns access token in response body, refresh token in HttpOnly cookie.
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await authService.login({ email, password });

      // Refresh token goes in a secure cookie — not in the response body
      res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

      return ApiResponse.success(res, 200, 'Login successful', { accessToken, user });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/refresh
   * Reads refresh token from HttpOnly cookie, issues new access token.
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return ApiResponse.error(res, 401, 'No refresh token provided.');
      }

      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(refreshToken);

      // Rotate the refresh token cookie
      res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

      return ApiResponse.success(res, 200, 'Token refreshed', { accessToken });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/logout
   * Clears the refresh token cookie and revokes the DB token.
   * Requires authentication (authGuard middleware).
   */
  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);

      // Clear the cookie by setting it with an expired date
      res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

      return ApiResponse.success(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user's profile.
   * Requires authGuard.
   */
  async getMe(req, res, next) {
    try {
      // req.user.id was attached by authGuard middleware
      const { id } = req.user;
      const userRepository = require('../repositories/userRepository');
      const user = await userRepository.findById(id);

      if (!user) {
        return ApiResponse.error(res, 404, 'User not found.');
      }

      return ApiResponse.success(res, 200, 'User profile fetched', { user });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
