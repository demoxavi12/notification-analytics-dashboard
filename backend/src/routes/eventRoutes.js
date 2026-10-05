const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  getEventStats,
  simulateServiceEvent,
} = require('../controllers/eventController');
const { authenticate } = require('../middleware/auth');
const { eventIngestLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTL_SECONDS } = require('../middleware/cache');

router.use(authenticate);

router.post('/', eventIngestLimiter, createEvent);
router.post('/simulate', eventIngestLimiter, simulateServiceEvent);
router.get('/stats', cacheMiddleware({ resource: 'events:stats', ttlSeconds: CACHE_TTL_SECONDS.stats }), getEventStats);
router.get('/', getEvents);
router.get('/:id', getEventById);

module.exports = router;
