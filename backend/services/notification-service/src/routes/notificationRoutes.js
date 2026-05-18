const { Router } = require('express');
const { body }   = require('express-validator');
const { notificationController, requireServiceSecret } = require('../controllers/notificationController');
const validate   = require('../middlewares/validate');

const router = Router();

// All notification routes require the service-to-service secret
router.use(requireServiceSecret);

// POST /api/notifications/order-confirmation
router.post(
  '/order-confirmation',
  [
    body('orderId').isUUID().withMessage('Valid order ID required'),
    body('userEmail').isEmail().withMessage('Valid email required'),
    body('totalAmount').notEmpty().withMessage('Total amount required'),
  ],
  validate,
  notificationController.sendOrderConfirmation
);

module.exports = router;
