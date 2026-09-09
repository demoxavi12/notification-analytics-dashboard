const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let isConnected = false;
let fallbackMemoryCache = new Map();

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) {
        // Stop excessive retrying to keep console clean and avoid spam
        return null;
      }
      return Math.min(times * 500, 2000);
    },
  });

  redisClient.on('connect', () => {
    isConnected = true;
    console.log(`[Redis] Connected successfully to ${REDIS_URL}`);
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('error', (err) => {
    if (isConnected) {
      console.warn(`[Redis] Runtime error: ${err.message}`);
    }
    isConnected = false;
  });

  redisClient.on('close', () => {
    isConnected = false;
  });
} catch (err) {
  console.warn(`[Redis] Failed to initialize client: ${err.message}`);
  isConnected = false;
}

// In-memory fallback garbage collector
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of fallbackMemoryCache.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      fallbackMemoryCache.delete(key);
    }
  }
}, 30000);

const isRedisConnected = () => {
  return isConnected && redisClient && redisClient.status === 'ready';
};

const getCache = async (key) => {
  try {
    if (isRedisConnected()) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (err) {
    console.warn(`[Redis Cache] GET error for key ${key}: ${err.message}`);
  }

  // Fallback to in-memory cache
  const item = fallbackMemoryCache.get(key);
  if (item) {
    if (!item.expiresAt || item.expiresAt > Date.now()) {
      return item.value;
    }
    fallbackMemoryCache.delete(key);
  }
  return null;
};

const setCache = async (key, value, ttlSeconds = 300) => {
  try {
    if (isRedisConnected()) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    }
  } catch (err) {
    console.warn(`[Redis Cache] SET error for key ${key}: ${err.message}`);
  }

  // Fallback to in-memory cache
  fallbackMemoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
  return true;
};

const deleteCache = async (key) => {
  try {
    if (isRedisConnected()) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.warn(`[Redis Cache] DEL error for key ${key}: ${err.message}`);
  }
  fallbackMemoryCache.delete(key);
};

const deletePattern = async (pattern) => {
  try {
    if (isRedisConnected()) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }
  } catch (err) {
    console.warn(`[Redis Cache] deletePattern error for ${pattern}: ${err.message}`);
  }

  // Fallback pattern matching
  const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of fallbackMemoryCache.keys()) {
    if (regexPattern.test(key)) {
      fallbackMemoryCache.delete(key);
    }
  }
};

module.exports = {
  redisClient,
  isRedisConnected,
  getCache,
  setCache,
  deleteCache,
  deletePattern,
};
