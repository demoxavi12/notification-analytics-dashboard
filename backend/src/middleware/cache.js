const { getCache, setCache, deletePattern } = require('../config/redis');

// Middleware to cache GET responses
const cacheMiddleware = (ttlSeconds = 60, keyPrefix = 'cache') => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const userId = req.user ? req.user._id : 'public';
    const role = req.user ? req.user.role : 'guest';
    const cacheKey = `${keyPrefix}:${req.baseUrl}${req.path}:${JSON.stringify(req.query)}:${role}:${userId}`;

    try {
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedData);
      }

      res.setHeader('X-Cache', 'MISS');

      // Hook into res.json to capture data and cache it
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Only cache successful 200 responses
        if (res.statusCode === 200 && body && body.success) {
          setCache(cacheKey, body, ttlSeconds).catch((err) => {
            console.warn(`[Cache Middleware] Failed setting cache: ${err.message}`);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn(`[Cache Middleware] Error: ${err.message}`);
      next();
    }
  };
};

// Invalidation helper
const invalidateAnalyticsCache = async () => {
  try {
    await deletePattern('cache:analytics:*');
    await deletePattern('cache:dashboard:*');
    await deletePattern('cache:stats:*');
  } catch (err) {
    console.warn(`[Cache Invalidation] Error: ${err.message}`);
  }
};

module.exports = {
  cacheMiddleware,
  invalidateAnalyticsCache,
};
