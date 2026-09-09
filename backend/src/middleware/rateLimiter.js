const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');

const isProduction = process.env.NODE_ENV === 'production';

// Development: 1-minute window, 100 attempts
// Production: 15-minute window, 20 attempts
const authWindowMs = process.env.AUTH_RATE_LIMIT_WINDOW_MS
  ? parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10)
  : isProduction
  ? 15 * 60 * 1000
  : 1 * 60 * 1000;

const authMax = process.env.AUTH_RATE_LIMIT_MAX
  ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)
  : isProduction
  ? 20
  : 100;

const windowMinutes = Math.ceil(authWindowMs / (60 * 1000));
const windowDisplay = windowMinutes > 1 ? `${windowMinutes} minutes` : '1 minute';

// Custom handler for rate limit exceeded
const createLimiterHandler = (customMessage) => (req, res, next, options) => {
  return errorResponse(
    res,
    customMessage || options.message,
    options.statusCode || 429,
    'RATE_LIMIT_EXCEEDED',
    {
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    }
  );
};

// Rate limiter for Auth endpoints (login, register)
const authLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler(
    `Too many authentication attempts from this IP. Please try again in ${windowDisplay}.`
  ),
});

// Rate limiter for high-volume event ingestion
const eventIngestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? 150 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Event ingestion rate limit reached. Please throttle batch requests.'),
});

// General API rate limiter
const generalApiLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 1 * 60 * 1000,
  max: isProduction ? 500 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many API requests. Please slow down.'),
});

module.exports = {
  authLimiter,
  eventIngestLimiter,
  generalApiLimiter,
};
