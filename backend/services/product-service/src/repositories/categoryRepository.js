/**
 * repositories/categoryRepository.js
 * Database operations for product categories.
 */

const { pool } = require('../config/database');

const categoryRepository = {
  async findAll() {
    const result = await pool.query(
      `SELECT id, name, slug, description, parent_id, created_at
       FROM categories
       ORDER BY name ASC`
    );
    return result.rows;
  },

  async findBySlug(slug) {
    const result = await pool.query(
      'SELECT * FROM categories WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create({ name, slug, description, parentId }) {
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, description || null, parentId || null]
    );
    return result.rows[0];
  },

  async update(id, { name, slug, description }) {
    const result = await pool.query(
      `UPDATE categories SET name = COALESCE($2, name), slug = COALESCE($3, slug),
       description = COALESCE($4, description)
       WHERE id = $1 RETURNING *`,
      [id, name, slug, description]
    );
    return result.rows[0] || null;
  },
};

module.exports = categoryRepository;
