const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Nodemailer transporter — configured once, reused across all sends.
 *
 * For development: Mailtrap catches all outbound emails without delivery.
 * For production: Swap SMTP credentials for SendGrid / AWS SES / Postmark.
 *
 * Why Nodemailer over a managed service SDK?
 * - Zero vendor lock-in: change SMTP provider by updating env vars only
 * - Mailtrap makes local testing trivial (emails appear in Mailtrap inbox)
 * - In production, SendGrid's SMTP relay is trivial to configure here
 */
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection pool for throughput
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

const emailService = {
  /**
   * Verify SMTP connection on startup.
   */
  async verify() {
    await transporter.verify();
    logger.info('SMTP connection verified');
  },

  /**
   * Send an order confirmation email.
   *
   * @param {object} params
   * @param {string} params.to          - Recipient email address
   * @param {string} params.orderId     - Order UUID
   * @param {string} params.totalAmount - Total amount as a formatted string (e.g. "999.00")
   * @param {object[]} params.items     - Array of order items (optional, for detail)
   */
  async sendOrderConfirmation({ to, orderId, totalAmount, items = [] }) {
    if (!to) {
      logger.warn('sendOrderConfirmation called with no recipient email', { orderId });
      return;
    }

    const shortOrderId = orderId.slice(0, 8).toUpperCase();
    const itemsHtml    = items.length > 0
      ? items.map((item) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${item.name}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">₹${item.unitPrice}</td>
          </tr>`
        ).join('')
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    
    <!-- Header -->
    <div style="background:#4f46e5;padding:32px 40px">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">ShopWave</h1>
      <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px">Your order has been confirmed!</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px">
      <p style="margin:0 0 8px;color:#374151;font-size:16px">
        Thanks for your order. We're getting it ready!
      </p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
        Order ID: <strong style="font-family:monospace;color:#374151">#${shortOrderId}</strong>
      </p>

      ${items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="padding:8px 0;text-align:left;font-size:13px;color:#6b7280;font-weight:600">Item</th>
            <th style="padding:8px 0;text-align:center;font-size:13px;color:#6b7280;font-weight:600">Qty</th>
            <th style="padding:8px 0;text-align:right;font-size:13px;color:#6b7280;font-weight:600">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      ` : ''}

      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:16px;font-weight:700;color:#111827">Total Paid</span>
          <span style="font-size:16px;font-weight:700;color:#4f46e5">₹${totalAmount}</span>
        </div>
      </div>

      <p style="margin:0;color:#6b7280;font-size:13px">
        We'll send another email when your order ships. Questions? Reply to this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
        ShopWave · This email was sent because you placed an order on ShopWave.
      </p>
    </div>
  </div>
</body>
</html>`;

    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'ShopWave <noreply@shopwave.dev>',
      to,
      subject: `Order Confirmed — #${shortOrderId}`,
      html,
      text: `Your ShopWave order #${shortOrderId} has been confirmed. Total: ₹${totalAmount}`,
    });

    logger.info('Order confirmation email sent', { to, orderId, messageId: info.messageId });
    return info;
  },

  /**
   * Send a generic transactional email.
   */
  async send({ to, subject, html, text }) {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ShopWave <noreply@shopwave.dev>',
      to,
      subject,
      html,
      text,
    });
    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return info;
  },
};

module.exports = emailService;
