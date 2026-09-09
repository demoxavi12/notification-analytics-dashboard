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
const { cacheMiddleware } = require('../middleware/cache');

router.use(authenticate);

router.post('/', createNotification);
router.get('/stats', cacheMiddleware(30, 'stats:notifications'), getNotificationStats);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.get('/', getNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
