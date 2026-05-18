/**
 * services/productService.js
 *
 * Business logic for the product catalog.
 *
 * Key concept: SLUG GENERATION
 * A slug is a URL-friendly version of a name: "Apple MacBook Pro" → "apple-macbook-pro"
 * Slugs must be unique. If "apple-macbook-pro" exists, we create "apple-macbook-pro-1".
 */

const productRepository = require('../repositories/productRepository');

class ProductNotFoundError extends Error {
  constructor(identifier) {
    super(`Product not found: ${identifier}`);
    this.name = 'ProductNotFoundError';
  }
}

class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock for this product');
    this.name = 'InsufficientStockError';
  }
}

/**
 * Convert a product name to a URL slug.
 * "Apple MacBook Pro 16" → "apple-macbook-pro-16"
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/-+/g, '-');           // Collapse multiple hyphens
};

const productService = {
  async getProducts(filters) {
    const limit = Math.min(
      parseInt(filters.limit) || parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
      parseInt(process.env.MAX_PAGE_SIZE) || 100  // Cap at max page size
    );
    return productRepository.findAll({ ...filters, limit });
  },

  async getProductBySlug(slug) {
    const product = await productRepository.findBySlug(slug);
    if (!product) throw new ProductNotFoundError(slug);
    return product;
  },

  async createProduct(data, adminUserId) {
    let slug = generateSlug(data.name);

    // Ensure slug uniqueness by appending a number if it exists
    const existing = await productRepository.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    return productRepository.create({ ...data, slug, createdBy: adminUserId });
  },

  async updateProduct(id, updates, adminUserId) {
    const product = await productRepository.findById(id);
    if (!product) throw new ProductNotFoundError(id);

    // If name is being updated, regenerate the slug
    if (updates.name) {
      updates.slug = generateSlug(updates.name);
    }

    return productRepository.update(id, updates);
  },

  async deleteProduct(id) {
    const result = await productRepository.deactivate(id);
    if (!result) throw new ProductNotFoundError(id);
    return { id };
  },
};

module.exports = { productService, ProductNotFoundError, InsufficientStockError };
