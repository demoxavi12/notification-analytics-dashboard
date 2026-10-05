const express = require('express');
const router = express.Router();
const { isDbConnected } = require('../config/db');
const { getRedisStatus } = require('../config/redis');

// @desc System health check endpoint
// @route GET /api/health
// @access Public
router.get('/', (req, res) => {
  const dbStatus = isDbConnected() ? 'connected' : 'disconnected';
  const redisStatus = getRedisStatus(); // 'connected' | 'disconnected' | 'disabled'

  // Overall status (and the HTTP code) follows MongoDB only. Redis is an optional cache:
  // when it is down or not configured the API keeps working on the in-memory cache, so
  // that is reported as `redis`/`cache` detail instead of failing the health check.
  const overallStatus = isDbConnected() ? 'ok' : 'degraded';

  const healthData = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    redis: redisStatus,
    cache: redisStatus === 'connected' ? 'redis' : 'memory',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  };

  const httpStatus = overallStatus === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(healthData);
});

module.exports = router;
