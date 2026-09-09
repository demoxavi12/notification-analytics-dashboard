const Event = require('../models/Event');
const { invalidateAnalyticsCache } = require('../middleware/cache');

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

  // Invalidate cached analytics results asynchronously
  invalidateAnalyticsCache().catch((err) => {
    console.warn(`[EventService] Cache invalidation warning: ${err.message}`);
  });

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
