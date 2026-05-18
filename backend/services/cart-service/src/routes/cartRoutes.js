/**
 * routes/cartRoutes.js
 *
 * GET    /api/cart          → Get current user's cart
 * POST   /api/cart/items    → Add item to cart
 * PATCH  /api/cart/items/:productId → Update item quantity
 * DELETE /api/cart/items/:productId → Remove item
 * DELETE /api/cart          → Clear entire cart
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const cartService = require('../services/cartService');
const { authGuard } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');
const ApiResponse = require('../utils/apiResponse');

const router = Router();

// All cart routes require authentication
router.use(authGuard);

// GET /api/cart
router.get('/', async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    return ApiResponse.success(res, 200, 'Cart fetched', { cart });
  } catch (err) { next(err); }
});

// POST /api/cart/items
router.post('/items', [
  body('productId').isUUID().withMessage('Valid productId required'),
  body('productName').trim().notEmpty().withMessage('Product name required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1–100'),
  validate,
], async (req, res, next) => {
  try {
    const cart = await cartService.addItem(req.user.id, req.body);
    return ApiResponse.success(res, 200, 'Item added to cart', { cart });
  } catch (err) { next(err); }
});

// PATCH /api/cart/items/:productId
router.patch('/items/:productId', [
  param('productId').isUUID(),
  body('quantity').isInt({ min: 0, max: 100 }).withMessage('Quantity must be 0–100'),
  validate,
], async (req, res, next) => {
  try {
    const cart = await cartService.updateItemQuantity(
      req.user.id,
      req.params.productId,
      req.body.quantity
    );
    return ApiResponse.success(res, 200, 'Cart updated', { cart });
  } catch (err) { next(err); }
});

// DELETE /api/cart/items/:productId
router.delete('/items/:productId', [
  param('productId').isUUID(),
  validate,
], async (req, res, next) => {
  try {
    const cart = await cartService.removeItem(req.user.id, req.params.productId);
    return ApiResponse.success(res, 200, 'Item removed from cart', { cart });
  } catch (err) { next(err); }
});

// DELETE /api/cart
router.delete('/', async (req, res, next) => {
  try {
    await cartService.clearCart(req.user.id);
    return ApiResponse.success(res, 200, 'Cart cleared');
  } catch (err) { next(err); }
});

module.exports = router;
