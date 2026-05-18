const jwt = require('jsonwebtoken');
const ApiResponse = require('../utils/apiResponse');

const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return ApiResponse.error(res, { message: 'Authentication required', statusCode: 401 });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return ApiResponse.error(res, { message: 'Invalid or expired token', statusCode: 401 });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return ApiResponse.error(res, { message: 'Insufficient permissions', statusCode: 403 });
  }
  next();
};

module.exports = { authGuard, requireRole };
