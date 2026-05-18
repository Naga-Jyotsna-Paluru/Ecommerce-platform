/**
 * routes/productRoutes.js
 *
 * REST API design for products — follows standard conventions:
 *
 * GET    /api/products          → List products (paginated, filterable)
 * GET    /api/products/:slug    → Get single product
 * POST   /api/products          → Create product (admin only)
 * PATCH  /api/products/:id      → Update product (admin only)
 * DELETE /api/products/:id      → Soft-delete product (admin only)
 *
 * WHY PATCH not PUT?
 * PUT replaces the entire resource. PATCH applies partial updates.
 * For product updates (change just the price), PATCH is semantically correct.
 */

const { Router } = require('express');
const { body, query, param } = require('express-validator');
const { productService, ProductNotFoundError } = require('../services/productService');
const { authGuard, requireRole } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');
const ApiResponse = require('../utils/apiResponse');

const router = Router();

// GET /api/products — public, paginated, filterable
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('search').optional().trim().isLength({ max: 100 }),
  query('categoryId').optional().isUUID(),
  query('sortBy').optional().isIn(['created_at', 'price', 'name']),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
], async (req, res, next) => {
  try {
    const result = await productService.getProducts(req.query);
    return ApiResponse.success(res, 200, 'Products fetched', result);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    return ApiResponse.success(res, 200, 'Product fetched', { product });
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      return ApiResponse.error(res, 404, err.message);
    }
    next(err);
  }
});

// POST /api/products — admin only
router.post('/', authGuard, requireRole('admin'), [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('description').optional().trim(),
  body('price').isFloat({ min: 0 }),
  body('stockQuantity').isInt({ min: 0 }),
  body('categoryId').optional().isUUID(),
  body('images').optional().isArray(),
  body('tags').optional().isArray(),
  validate,
], async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body, req.user.id);
    return ApiResponse.success(res, 201, 'Product created', { product });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id — admin only
router.patch('/:id', authGuard, requireRole('admin'), [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('stockQuantity').optional().isInt({ min: 0 }),
  validate,
], async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body, req.user.id);
    return ApiResponse.success(res, 200, 'Product updated', { product });
  } catch (err) {
    if (err instanceof ProductNotFoundError) return ApiResponse.error(res, 404, err.message);
    next(err);
  }
});

// DELETE /api/products/:id — admin only (soft delete)
router.delete('/:id', authGuard, requireRole('admin'), [
  param('id').isUUID(),
  validate,
], async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id);
    return ApiResponse.success(res, 200, 'Product deactivated');
  } catch (err) {
    if (err instanceof ProductNotFoundError) return ApiResponse.error(res, 404, err.message);
    next(err);
  }
});

module.exports = router;
