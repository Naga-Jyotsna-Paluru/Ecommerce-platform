/**
 * services/productServiceClient.js
 *
 * HTTP client for communicating with the Product Service.
 *
 * In a microservices architecture, services talk to each other via HTTP (or a message queue).
 * This file encapsulates all calls TO the product service FROM the order service.
 *
 * WHY NOT IMPORT THE PRODUCT REPO DIRECTLY?
 * Because each service is an independent process with its own database.
 * The order-service has no access to the product-service database.
 * This enforces true service isolation — a core microservices principle.
 *
 * In Phase 5 (Microservices extraction), this client will be the only change needed
 * since we've already abstracted it here.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

// Axios instance with timeout — never let a slow downstream service hang forever
const productClient = axios.create({
  baseURL: PRODUCT_SERVICE_URL,
  timeout: 5000, // 5 seconds max wait for product service
});

const productServiceClient = {
  /**
   * Validate a list of products exist and have sufficient stock.
   * Returns enriched items with current price (source of truth = product service).
   *
   * @param {Array<{productId, quantity}>} items
   * @returns {Array<{productId, productName, quantity, unitPrice}>}
   */
  async validateAndEnrichCartItems(items) {
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let product;
        try {
          // We call by ID — but our product routes use slug.
          // We need a /api/products/id/:id route, OR we store slugs in the cart.
          // For now, we call a dedicated internal stock check endpoint.
          const response = await productClient.get(`/api/products/internal/${item.productId}`);
          product = response.data.data.product;
        } catch (error) {
          if (error.response?.status === 404) {
            throw new Error(`Product ${item.productId} not found`);
          }
          logger.error('Product service call failed', { error: error.message, productId: item.productId });
          throw new Error('Product service is unavailable. Please try again.');
        }

        if (!product.is_active) {
          throw new Error(`Product "${product.name}" is no longer available`);
        }

        if (product.stock_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, requested: ${item.quantity}`
          );
        }

        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: parseFloat(product.price), // Always use product service as price source
        };
      })
    );

    return enrichedItems;
  },

  /**
   * Decrement stock for multiple products.
   * Called after the order DB record is created.
   * Passes the JWT forward so product-service can authorize the internal call.
   */
  async decrementStock(items, authToken) {
    try {
      await productClient.post(
        '/api/products/internal/decrement-stock',
        { items },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    } catch (error) {
      logger.error('Failed to decrement stock', { error: error.message });
      throw new Error('Failed to update product inventory');
    }
  },
};

module.exports = productServiceClient;
