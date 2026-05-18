const jwt = require('jsonwebtoken');
const ApiResponse = require('../utils/apiResponse');

const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ApiResponse.error(res, 401, 'Authentication required. Please log in.');
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 401, 'Access token expired. Please refresh your session.');
    }
    return ApiResponse.error(res, 401, 'Invalid access token.');
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return ApiResponse.error(res, 401, 'Authentication required.');
    if (!roles.includes(req.user.role)) {
      return ApiResponse.error(res, 403, 'You do not have permission to perform this action.');
    }
    next();
  };
};

module.exports = { authGuard, requireRole };
