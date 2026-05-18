const { Router }    = require('express');
const { body }      = require('express-validator');
const express       = require('express');
const paymentController = require('../controllers/paymentController');
const { authGuard, requireRole } = require('../middlewares/authGuard');
const validate      = require('../middlewares/validate');

const router = Router();

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
// MUST be registered BEFORE the json() middleware in app.js
// This route uses raw body parsing (handled in app.js) so Stripe can verify
// the payload signature. If we JSON-parse first, the signature check fails.
router.post('/webhook', paymentController.handleWebhook);

// ─── POST /api/payments/create-intent ────────────────────────────────────────
// Frontend calls this after creating an order to get a Stripe client_secret
router.post(
  '/create-intent',
  authGuard,
  [
    body('orderId').isUUID().withMessage('Valid order ID required'),
    body('totalAmount')
      .isFloat({ min: 0.01 })
      .withMessage('Total amount must be a positive number'),
    body('currency')
      .optional()
      .isIn(['inr', 'usd', 'eur', 'gbp'])
      .withMessage('Unsupported currency'),
  ],
  validate,
  paymentController.createIntent
);

// ─── GET /api/payments/order/:orderId ────────────────────────────────────────
router.get('/order/:orderId', authGuard, paymentController.getPaymentByOrder);

module.exports = router;
