const express = require('express');
const router = express.Router();
const {
  getOverview,
  getTimeSeries,
  getDistributions,
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

router.use(authenticate);

// Analytics endpoints with Redis/in-memory caching
router.get('/overview', cacheMiddleware(60, 'cache:analytics:overview'), getOverview);
router.get('/timeseries', cacheMiddleware(60, 'cache:analytics:timeseries'), getTimeSeries);
router.get('/distributions', cacheMiddleware(60, 'cache:analytics:distributions'), getDistributions);

module.exports = router;
