const express = require('express');
const router = express.Router();
const { isDbConnected } = require('../config/db');
const { isRedisConnected } = require('../config/redis');

// @desc System health check endpoint
// @route GET /api/health
// @access Public
router.get('/', (req, res) => {
  const dbStatus = isDbConnected() ? 'connected' : 'disconnected';
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';

  // Overall status is ok even if redis falls back to in-memory, but reports degraded if db is down
  const overallStatus = isDbConnected() ? 'ok' : 'degraded';

  const healthData = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    redis: redisStatus,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  };

  const httpStatus = overallStatus === 'ok' ? 200 : 503;
  return res.status(httpStatus).json(healthData);
});

module.exports = router;
