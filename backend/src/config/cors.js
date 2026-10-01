// CORS policy. Origins come from configuration, never from the request:
//  - CLIENT_URL: the frontend origin(s); comma-separate to allow several
//    (e.g. "https://app.example.com,https://admin.example.com").
//  - Outside production, any http://localhost:<port> / http://127.0.0.1:<port> is
//    also allowed so local dev servers on any port keep working.
// Requests from other origins get no CORS headers, so browsers refuse to expose
// responses to them (and credentialed requests are never granted to them).

const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '').toLowerCase();

const parseConfiguredOrigins = (clientUrl = '') =>
  clientUrl
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

const createOriginChecker = ({ clientUrl = process.env.CLIENT_URL, nodeEnv = process.env.NODE_ENV } = {}) => {
  const allowed = new Set(parseConfiguredOrigins(clientUrl));
  const allowLocalDev = nodeEnv !== 'production';

  return (origin) => {
    // No Origin header: same-origin requests, curl, server-to-server. CORS doesn't apply.
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    if (allowed.has(normalized)) return true;
    return allowLocalDev && LOCAL_DEV_ORIGIN.test(normalized);
  };
};

const buildCorsOptions = (config) => {
  const isAllowed = createOriginChecker(config);
  return {
    origin: (origin, callback) => callback(null, isAllowed(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
};

module.exports = { buildCorsOptions, createOriginChecker, parseConfiguredOrigins };
