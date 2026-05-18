/**
 * routes/internalRoutes.js — Product Service
 *
 * Internal endpoints — called ONLY by other backend services, never the public.
 *
 * SECURITY: These routes still require a valid JWT (admin or service token).
 * In Phase 5, we'll add an internal API key check instead of relying solely on JWT.
 *
 * Endpoints:
 * GET  /api/products/internal/:id              → Fetch product by UUID (for order-service)
 * POST /api/products/internal/decrement-stock  → Atomic stock decrement (for order-service)
 */

const { Router } = require('express');
const { body } = require('express-validator');
const { pool } = require('../config/database');
const productRepository = require('../repositories/productRepository');
const { authGuard } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');
const ApiResponse = require('../utils/apiResponse');

const router = Router();

// GET /api/products/internal/:id — fetch product by UUID
router.get('/:id', authGuard, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.id]
    );
    const product = result.rows[0];
    if (!product) return ApiResponse.error(res, 404, 'Product not found');
    return ApiResponse.success(res, 200, 'Product fetched', { product });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/internal/decrement-stock
router.post('/decrement-stock', authGuard, [
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  validate,
], async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of req.body.items) {
      const result = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $2, updated_at = NOW()
         WHERE id = $1 AND stock_quantity >= $2
         RETURNING id, stock_quantity`,
        [item.productId, item.quantity]
      );

      if (result.rows.length === 0) {
        // Abort the entire batch — rollback all decrements done so far
        await client.query('ROLLBACK');
        return ApiResponse.error(res, 409, `Insufficient stock for product ${item.productId}`);
      }
    }

    await client.query('COMMIT');
    return ApiResponse.success(res, 200, 'Stock decremented');
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
