const express = require('express');
const router = express.Router();
const {
  getOverview,
  getTimeSeries,
  getDistributions,
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware, CACHE_TTL_SECONDS } = require('../middleware/cache');

router.use(authenticate);

// Cached per authorization scope; `varyBy` must list every query param the controller reads.
const ttlSeconds = CACHE_TTL_SECONDS.analytics;
router.get('/overview', cacheMiddleware({ resource: 'analytics:overview', ttlSeconds, varyBy: ['range', 'service'] }), getOverview);
router.get('/timeseries', cacheMiddleware({ resource: 'analytics:timeseries', ttlSeconds, varyBy: ['range', 'service'] }), getTimeSeries);
router.get('/distributions', cacheMiddleware({ resource: 'analytics:distributions', ttlSeconds, varyBy: ['range'] }), getDistributions);

module.exports = router;
