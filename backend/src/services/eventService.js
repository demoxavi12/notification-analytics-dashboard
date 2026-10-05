const Event = require('../models/Event');
const { invalidateCacheFor } = require('../middleware/cache');

/**
 * Event recording service that acts as the ingestion pipeline
 */
const recordEvent = async ({
  eventType,
  source = 'system',
  userId = null,
  service = 'system',
  metadata = {},
  status = 'info',
  timestamp = new Date(),
}) => {
  const event = await Event.create({
    eventType,
    source,
    userId,
    service,
    metadata,
    status,
    timestamp,
  });

  // A user's event changes their own scope (plus the admin view); an unowned system
  // event is visible to everyone. Awaited so an immediate refetch is never stale.
  await invalidateCacheFor(userId ? { userIds: [userId] } : { allUsers: true });

  return event;
};

// Specialized service simulation helpers
const logAuthEvent = async (eventType, userId, metadata = {}, status = 'success') => {
  return recordEvent({
    eventType,
    source: 'auth-service',
    service: 'auth-service',
    userId,
    metadata,
    status,
  });
};

const logNotificationEvent = async (eventType, userId, metadata = {}, status = 'success') => {
  return recordEvent({
    eventType,
    source: 'notification-service',
    service: 'notification-service',
    userId,
    metadata,
    status,
  });
};

const logPaymentEvent = async (eventType, userId, metadata = {}, status = 'success') => {
  return recordEvent({
    eventType,
    source: 'payment-service',
    service: 'payment-service',
    userId,
    metadata,
    status,
  });
};

module.exports = {
  recordEvent,
  logAuthEvent,
  logNotificationEvent,
  logPaymentEvent,
};
