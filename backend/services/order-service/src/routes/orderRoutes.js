/**
 * routes/orderRoutes.js
 *
 * REST API for orders:
 *
 * POST   /api/orders              → Place a new order (customer)
 * GET    /api/orders/my           → Get my orders (customer)
 * GET    /api/orders/:id          → Get order by ID (owner or admin)
 * PATCH  /api/orders/:id/cancel   → Cancel order (owner only)
 * GET    /api/orders              → All orders (admin only)
 * PATCH  /api/orders/:id/status   → Update status (admin only)
 */

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const orderController = require('../controllers/orderController');
const { authGuard, requireRole } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');

const router = Router();

// Validation for creating an order
const createOrderValidation = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId')
    .isUUID().withMessage('Each item must have a valid productId'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100'),
  body('shippingAddress')
    .isObject().withMessage('Shipping address is required'),
  body('shippingAddress.fullName')
    .trim().notEmpty().withMessage('Full name is required'),
  body('shippingAddress.street')
    .trim().notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city')
    .trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state')
    .trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.postalCode')
    .trim().notEmpty().withMessage('Postal code is required'),
  body('shippingAddress.country')
    .trim().notEmpty().withMessage('Country is required'),
  body('notes')
    .optional().trim().isLength({ max: 500 }),
];

// Customer routes
router.post('/',      authGuard, createOrderValidation, validate, orderController.createOrder);
router.get('/my',     authGuard, orderController.getMyOrders);
router.get('/:id',    authGuard, [param('id').isUUID(), validate], orderController.getOrderById);
router.patch('/:id/cancel', authGuard, [param('id').isUUID(), validate], orderController.cancelOrder);

// Admin routes
router.get('/',           authGuard, requireRole('admin'), orderController.getAllOrders);
router.patch('/:id/status', authGuard, requireRole('admin'), [
  param('id').isUUID(),
  body('status').isIn(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid status value'),
  validate,
], orderController.updateOrderStatus);

module.exports = router;
