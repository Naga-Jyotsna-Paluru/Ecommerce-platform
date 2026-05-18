/**
 * routes/authRoutes.js
 *
 * Route definitions for the auth service.
 * Routes are the "public API" of your service — define them carefully.
 *
 * PATTERN: Route file only wires up: validation → middleware → controller
 * No logic lives here.
 *
 * VERSIONING: All routes are prefixed with /api/auth (set in app.js).
 * In the future, if we need to change behavior, we add /api/v2/auth
 * without breaking existing clients.
 */

const { Router } = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authGuard } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');

const router = Router();

// --- Validation Rule Sets ---
// Define once, reuse — keeps routes readable

const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2–100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(), // Lowercase + strips dots from Gmail addresses

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    // Require at least one uppercase, one lowercase, one number, one symbol
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// --- Route Definitions ---

// Public routes (no authentication required)
router.post('/register', registerValidation, validate, authController.register);
router.post('/login',    loginValidation,    validate, authController.login);
router.post('/refresh',  authController.refresh);

// Protected routes (must have valid access token)
router.post('/logout', authGuard, authController.logout);
router.get('/me',      authGuard, authController.getMe);

module.exports = router;
