const { errorResponse } = require('../utils/apiResponse');

// 404 Not Found Middleware
const notFoundHandler = (req, res, next) => {
  // Path only: never echo the query string (it may carry tokens or junk input).
  return errorResponse(res, `Route not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND');
};

// Global Error Handler Middleware
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = typeof err.code === 'string' ? err.code : 'SERVER_ERROR';
  let details = err.details || null;

  // Body parser failures (express.json): report the problem, not parser internals.
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
    errorCode = 'PAYLOAD_TOO_LARGE';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body is not valid JSON';
    errorCode = 'INVALID_JSON';
  } else if (err.type && statusCode < 500) {
    message = 'Invalid request body';
    errorCode = 'INVALID_REQUEST';
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field: ${err.path}`;
    errorCode = 'INVALID_ID_FORMAT';
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Handle Mongoose Duplicate Key (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value entered for: ${field}. Please use another value.`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  if (statusCode >= 500) {
    // Unexpected failures can carry driver messages, connection strings, file paths or
    // query details: log server-side (stack only in development), never send them.
    if (process.env.NODE_ENV === 'development') {
      console.error('[Error Details]:', err);
    } else if (process.env.NODE_ENV !== 'test') {
      console.error(`[Error] ${err.name || 'Error'} on ${req.method} ${req.path}`);
    }
    return errorResponse(res, 'Internal Server Error', statusCode, 'SERVER_ERROR');
  }

  return errorResponse(res, message, statusCode, errorCode, details);
};

// Async wrapper to avoid try/catch boilerplate in route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler,
};
