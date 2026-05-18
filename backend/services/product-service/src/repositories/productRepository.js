/**
 * repositories/productRepository.js
 *
 * All database queries for products and categories.
 * Demonstrates advanced PostgreSQL patterns: full-text search, pagination,
 * parameterized dynamic filters.
 */

const { pool } = require('../config/database');

const productRepository = {
  /**
   * Paginated product listing with optional filters.
   *
   * PAGINATION PATTERN: Offset-based (simple, good for admin panels)
   * For high-scale (millions of rows), you'd use cursor-based pagination instead.
   *
   * SECURITY: All filter values go through parameterized queries ($1, $2...)
   * NEVER interpolate user input directly into SQL strings.
   */
  async findAll({ page = 1, limit = 20, categoryId, search, minPrice, maxPrice, sortBy = 'created_at', order = 'DESC' }) {
    const validSortColumns = ['created_at', 'price', 'name'];
    const validOrders = ['ASC', 'DESC'];

    // Whitelist sort options — never trust client-provided sort column names
    const safeSort = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const conditions = ['p.is_active = TRUE'];
    const params = [];
    let paramIdx = 1;

    if (categoryId) {
      conditions.push(`p.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }

    if (search) {
      // PostgreSQL full-text search using the GIN index we created
      conditions.push(`to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${paramIdx++})`);
      params.push(search);
    }

    if (minPrice !== undefined) {
      conditions.push(`p.price >= $${paramIdx++}`);
      params.push(minPrice);
    }

    if (maxPrice !== undefined) {
      conditions.push(`p.price <= $${paramIdx++}`);
      params.push(maxPrice);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Two queries in one transaction: data + total count for pagination metadata
    const dataQuery = `
      SELECT
        p.id, p.name, p.slug, p.description,
        p.price, p.compare_price, p.stock_quantity,
        p.images, p.tags, p.created_at,
        c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY p.${safeSort} ${safeOrder}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM products p WHERE ${whereClause}
    `;

    params.push(limit, offset);
    const countParams = params.slice(0, paramIdx - 3); // Params without limit/offset

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, countParams),
    ]);

    return {
      products: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },

  async findBySlug(slug) {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.is_active = TRUE`,
      [slug]
    );
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async create({ name, slug, description, price, comparePrice, stockQuantity, categoryId, images, tags, createdBy }) {
    const result = await pool.query(
      `INSERT INTO products (name, slug, description, price, compare_price, stock_quantity, category_id, images, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, slug, description, price, comparePrice, stockQuantity, categoryId, JSON.stringify(images || []), tags || [], createdBy]
    );
    return result.rows[0];
  },

  async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    const result = await pool.query(
      `UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  // Soft delete — set is_active to false, never hard delete
  async deactivate(id) {
    const result = await pool.query(
      'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  },

  // Atomic stock update — prevents race conditions with concurrent requests
  async decrementStock(id, quantity, client = pool) {
    const result = await client.query(
      `UPDATE products
       SET stock_quantity = stock_quantity - $2, updated_at = NOW()
       WHERE id = $1 AND stock_quantity >= $2
       RETURNING id, stock_quantity`,
      [id, quantity]
    );
    return result.rows[0] || null; // null = insufficient stock
  },
};

module.exports = productRepository;
