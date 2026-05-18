/**
 * controllers/orderController.js
 *
 * Thin HTTP layer — extracts request data, calls service, sends response.
 * The authToken is forwarded to the service for inter-service calls.
 */

const { orderService } = require('../services/orderService');
const ApiResponse = require('../utils/apiResponse');

const orderController = {
  async createOrder(req, res, next) {
    try {
      const { items, shippingAddress, notes } = req.body;
      // Forward the Bearer token so product-service can authorize the stock decrement
      const authToken = req.headers.authorization?.split(' ')[1];

      const order = await orderService.createOrder(
        { userId: req.user.id, items, shippingAddress, notes },
        authToken
      );

      return ApiResponse.success(res, 201, 'Order placed successfully', { order });
    } catch (error) {
      next(error);
    }
  },

  async getMyOrders(req, res, next) {
    try {
      const result = await orderService.getUserOrders(req.user.id, {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      });
      return ApiResponse.success(res, 200, 'Orders fetched', result);
    } catch (error) {
      next(error);
    }
  },

  async getOrderById(req, res, next) {
    try {
      const order = await orderService.getOrderById(
        req.params.id,
        req.user.id,
        req.user.role
      );
      return ApiResponse.success(res, 200, 'Order fetched', { order });
    } catch (error) {
      next(error);
    }
  },

  async cancelOrder(req, res, next) {
    try {
      const order = await orderService.cancelOrder(req.params.id, req.user.id);
      return ApiResponse.success(res, 200, 'Order cancelled', { order });
    } catch (error) {
      next(error);
    }
  },

  // Admin only
  async getAllOrders(req, res, next) {
    try {
      const orders = await orderService.getAllOrders({
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        status: req.query.status,
      });
      return ApiResponse.success(res, 200, 'All orders fetched', { orders });
    } catch (error) {
      next(error);
    }
  },

  // Admin only
  async updateOrderStatus(req, res, next) {
    try {
      const order = await orderService.updateOrderStatus(
        req.params.id,
        req.body.status,
        req.user.id
      );
      return ApiResponse.success(res, 200, 'Order status updated', { order });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = orderController;
