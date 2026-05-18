/**
 * routes/categoryRoutes.js
 *
 * GET    /api/categories        → List all categories (public)
 * GET    /api/categories/:slug  → Get single category with its products
 * POST   /api/categories        → Create category (admin only)
 * PATCH  /api/categories/:id    → Update category (admin only)
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const categoryRepository = require('../repositories/categoryRepository');
const { authGuard, requireRole } = require('../middlewares/authGuard');
const validate = require('../middlewares/validate');
const ApiResponse = require('../utils/apiResponse');

const router = Router();

const generateSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

// GET /api/categories — public
router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryRepository.findAll();
    return ApiResponse.success(res, 200, 'Categories fetched', { categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const category = await categoryRepository.findBySlug(req.params.slug);
    if (!category) return ApiResponse.error(res, 404, 'Category not found');
    return ApiResponse.success(res, 200, 'Category fetched', { category });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — admin only
router.post('/', authGuard, requireRole('admin'), [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('description').optional().trim(),
  body('parentId').optional().isUUID(),
  validate,
], async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    const slug = generateSlug(name);

    const existing = await categoryRepository.findBySlug(slug);
    if (existing) return ApiResponse.error(res, 409, 'A category with this name already exists');

    const category = await categoryRepository.create({ name, slug, description, parentId });
    return ApiResponse.success(res, 201, 'Category created', { category });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id — admin only
router.patch('/:id', authGuard, requireRole('admin'), [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  validate,
], async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.name) updates.slug = generateSlug(updates.name);

    const category = await categoryRepository.update(req.params.id, updates);
    if (!category) return ApiResponse.error(res, 404, 'Category not found');
    return ApiResponse.success(res, 200, 'Category updated', { category });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
