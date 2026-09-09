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
const { cacheMiddleware } = require('../middleware/cache');

router.use(authenticate);

router.post('/', eventIngestLimiter, createEvent);
router.post('/simulate', simulateServiceEvent);
router.get('/stats', cacheMiddleware(30, 'stats:events'), getEventStats);
router.get('/', getEvents);
router.get('/:id', getEventById);

module.exports = router;
