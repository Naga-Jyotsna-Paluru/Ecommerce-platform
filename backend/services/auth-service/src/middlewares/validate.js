/**
 * middlewares/validate.js
 *
 * Request validation middleware using express-validator.
 *
 * WHY VALIDATE AT THE MIDDLEWARE LEVEL?
 * Input validation is a security boundary. By validating before the controller
 * runs, we ensure malformed or malicious data never reaches business logic.
 * This is the OWASP recommended approach for preventing injection attacks.
 */

const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

/**
 * Runs after express-validator checks and returns 400 if any check failed.
 * Use this as the last item in a validation chain.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format validation errors into a clean array for the client
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return ApiResponse.error(res, 400, 'Validation failed', formattedErrors);
  }

  next();
};

module.exports = validate;
