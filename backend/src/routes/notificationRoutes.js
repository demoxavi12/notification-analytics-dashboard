const express = require('express');
const router = express.Router();
const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationStats,
  deleteNotification,
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { notificationWriteLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTL_SECONDS } = require('../middleware/cache');

router.use(authenticate);

router.post('/', notificationWriteLimiter, createNotification);
router.get('/stats', cacheMiddleware({ resource: 'notifications:stats', ttlSeconds: CACHE_TTL_SECONDS.stats }), getNotificationStats);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.get('/', getNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
