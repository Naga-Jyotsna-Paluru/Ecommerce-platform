/**
 * models/productModel.js
 *
 * Schema for products and categories tables.
 *
 * KEY DESIGN DECISIONS:
 * - price stored as DECIMAL(10,2) — never use FLOAT for money (floating point errors)
 *   Example: 0.1 + 0.2 = 0.30000000000000004 in floating point
 * - images stored as JSONB array — flexible, no separate images table needed at this scale
 * - slug for SEO-friendly URLs (/products/apple-macbook-pro instead of /products/uuid)
 * - soft delete with is_active flag — we never hard-delete products (order history breaks)
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

const createProductTables = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL UNIQUE,
      slug        VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
      created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name           VARCHAR(255) NOT NULL,
      slug           VARCHAR(255) NOT NULL UNIQUE,
      description    TEXT,
      price          DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
      compare_price  DECIMAL(10, 2) CHECK (compare_price >= 0),
      stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
      images         JSONB NOT NULL DEFAULT '[]',
      tags           TEXT[],
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_by     UUID NOT NULL,
      created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

    -- Full-text search index on product name and description
    CREATE INDEX IF NOT EXISTS idx_products_search
      ON products USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
  `;

  try {
    await pool.query(query);
    logger.info('Product tables are ready');
  } catch (error) {
    logger.error('Failed to create product tables', { error: error.message });
    throw error;
  }
};

module.exports = { createProductTables };
