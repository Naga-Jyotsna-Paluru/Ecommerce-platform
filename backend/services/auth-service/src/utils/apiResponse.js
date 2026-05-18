/**
 * utils/apiResponse.js
 *
 * Standardizes all API responses across the service.
 *
 * WHY THIS MATTERS:
 * Without a standard response shape, different endpoints return different
 * structures. The frontend has to handle inconsistency everywhere.
 * With this utility, EVERY response looks the same:
 *
 * Success: { success: true,  data: {...},  message: "..." }
 * Error:   { success: false, error: {...}, message: "..." }
 *
 * This is the pattern used at companies like Stripe, Twilio, and Google APIs.
 */

class ApiResponse {
  /**
   * Send a successful response.
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code (200, 201, etc.)
   * @param {string} message - Human-readable success message
   * @param {any} data - The payload to return
   */
  static success(res, statusCode = 200, message = 'Success', data = null) {
    const response = { success: true, message };
    if (data !== null) response.data = data;
    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response.
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code (400, 401, 404, 500, etc.)
   * @param {string} message - Human-readable error message
   * @param {any} errors - Validation errors or debug info (never in production)
   */
  static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
    const response = { success: false, message };
    // Only expose detailed errors in development to avoid leaking server internals
    if (errors !== null && process.env.NODE_ENV !== 'production') {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse;
