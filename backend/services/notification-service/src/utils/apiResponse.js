class ApiResponse {
  static success(res, { message = 'Success', data = null, statusCode = 200 } = {}) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static error(res, { message = 'Internal server error', statusCode = 500 } = {}) {
    return res.status(statusCode).json({ success: false, message });
  }
}

module.exports = ApiResponse;
