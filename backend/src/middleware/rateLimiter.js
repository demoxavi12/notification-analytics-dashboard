const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');

// Limits are keyed by client IP (express-rate-limit's default, IPv6-subnet aware).
// Behind a reverse proxy, set TRUST_PROXY (see app.js) so req.ip is the real client
// rather than the proxy; otherwise every user would share a single bucket.
//
// Storage is the in-process memory store: counters are per server instance and reset
// on restart. It does not depend on Redis, so a Redis outage never disables limiting.

const isProduction = process.env.NODE_ENV === 'production';

// Positive integer from the environment, or the fallback when unset/invalid
// (a typo must not silently disable a limit via NaN).
const positiveIntFromEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Development: 1-minute window, 100 attempts
// Production: 15-minute window, 20 attempts
const authWindowMs = positiveIntFromEnv(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  isProduction ? 15 * 60 * 1000 : 1 * 60 * 1000
);
const authMax = positiveIntFromEnv(process.env.AUTH_RATE_LIMIT_MAX, isProduction ? 20 : 100);

const windowMinutes = Math.ceil(authWindowMs / (60 * 1000));
const windowDisplay = windowMinutes > 1 ? `${windowMinutes} minutes` : '1 minute';

// Custom handler for rate limit exceeded
const createLimiterHandler = (customMessage) => (req, res, next, options) => {
  // Report the time until this client's window actually resets, not the full window.
  const resetTime = req.rateLimit?.resetTime;
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : Math.ceil(options.windowMs / 1000);

  return errorResponse(res, customMessage || options.message, options.statusCode || 429, 'RATE_LIMIT_EXCEEDED', {
    retryAfterSeconds,
  });
};

// Rate limiter for Auth endpoints (login, register)
const authLimiter = rateLimit({
  windowMs: authWindowMs,
  limit: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler(
    `Too many authentication attempts from this IP. Please try again in ${windowDisplay}.`
  ),
});

// Rate limiter for event writes (ingestion + simulation)
const eventIngestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isProduction ? 150 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Event ingestion rate limit reached. Please throttle batch requests.'),
});

// Rate limiter for notification dispatch (POST /notifications)
const notificationWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: isProduction ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Notification dispatch rate limit reached. Please slow down.'),
});

// General API rate limiter
const generalApiLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 1 * 60 * 1000,
  limit: isProduction ? 500 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many API requests. Please slow down.'),
});

module.exports = {
  authLimiter,
  eventIngestLimiter,
  notificationWriteLimiter,
  generalApiLimiter,
  positiveIntFromEnv,
};
