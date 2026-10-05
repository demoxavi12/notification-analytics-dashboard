const Notification = require('../models/Notification');
const { logNotificationEvent } = require('./eventService');

/**
 * Notification service handling delivery tracking and event emission
 */
const sendNotification = async ({
  recipient,
  title,
  message,
  type = 'info',
  channel = 'in-app',
  status = 'delivered',
  metadata = {},
}) => {
  const notification = await Notification.create({
    recipient,
    title,
    message,
    type,
    channel,
    status,
    metadata,
  });

  // Emit event in event system
  const eventStatus = status === 'failed' ? 'error' : 'success';
  const eventType = status === 'failed' ? 'notification.failed' : 'notification.delivered';

  await logNotificationEvent(eventType, recipient, {
    notificationId: notification._id,
    channel,
    type,
    title,
  }, eventStatus);
  // logNotificationEvent -> recordEvent already invalidated the recipient's and the
  // admin cache scopes after the notification was stored.

  return notification;
};

module.exports = {
  sendNotification,
};
