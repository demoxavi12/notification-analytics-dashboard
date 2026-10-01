const Event = require('../models/Event');
const { recordEvent } = require('../services/eventService');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { queryString, escapeRegex } = require('../utils/queryInput');

// @desc Ingest a new event
// @route POST /api/events
// @access Private (authenticated or API service key)
const createEvent = asyncHandler(async (req, res) => {
  const { eventType, source, service, metadata, status, userId } = req.body;

  if (!eventType || !service) {
    return errorResponse(res, 'eventType and service are required fields', 400, 'MISSING_FIELDS');
  }

  const validServices = ['auth-service', 'notification-service', 'payment-service', 'api-gateway', 'system'];
  if (!validServices.includes(service)) {
    return errorResponse(
      res,
      `Invalid service. Must be one of: ${validServices.join(', ')}`,
      400,
      'INVALID_SERVICE'
    );
  }

  const event = await recordEvent({
    eventType,
    source: source || 'api',
    userId: userId || (req.user ? req.user._id : null),
    service,
    metadata: metadata || {},
    status: status || 'info',
  });

  return successResponse(res, { event }, 'Event ingested successfully', 201);
});

// Visibility scope for event queries. Admins see every event; everyone else sees
// only their own events plus unowned system events (userId: null). This must be
// combined with other conditions via $and so no filter can widen it.
const eventScopeFor = (user) =>
  user.role === 'admin' ? {} : { $or: [{ userId: user._id }, { userId: null }] };

// @desc Retrieve paginated & filtered events
// @route GET /api/events
// @access Private
const getEvents = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
  const skip = (page - 1) * limit;

  const service = queryString(req.query.service);
  const status = queryString(req.query.status);
  const eventType = queryString(req.query.eventType);
  const search = queryString(req.query.search);
  const startDate = queryString(req.query.startDate, 40);
  const endDate = queryString(req.query.endDate, 40);

  // Role-based visibility is always the first condition; filters only narrow it.
  const conditions = [eventScopeFor(req.user)];

  if (service && service !== 'all') conditions.push({ service });
  if (status && status !== 'all') conditions.push({ status });
  if (eventType && eventType !== 'all') conditions.push({ eventType });

  if (search) {
    const pattern = escapeRegex(search);
    conditions.push({
      $or: [
        { eventType: { $regex: pattern, $options: 'i' } },
        { source: { $regex: pattern, $options: 'i' } },
      ],
    });
  }

  if (startDate || endDate) {
    const timestamp = {};
    if (startDate) timestamp.$gte = new Date(startDate);
    if (endDate) timestamp.$lte = new Date(endDate);
    conditions.push({ timestamp });
  }

  // The same scoped query drives both the page and the total count, so pagination
  // totals never reveal events outside the caller's scope.
  const query = { $and: conditions };

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    Event.countDocuments(query),
  ]);

  return paginatedResponse(res, events, { total, page, limit }, 'Events retrieved successfully');
});

// @desc Get single event by ID
// @route GET /api/events/:id
// @access Private
const getEventById = asyncHandler(async (req, res) => {
  // Scope is part of the lookup itself: an event outside the caller's scope is
  // indistinguishable from one that doesn't exist (no ID probing via 403 vs 404).
  const event = await Event.findOne({ $and: [{ _id: req.params.id }, eventScopeFor(req.user)] }).populate(
    'userId',
    'name email role'
  );
  if (!event) {
    return errorResponse(res, 'Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return successResponse(res, { event }, 'Event details retrieved');
});

// @desc Get event statistics summary
// @route GET /api/events/stats
// @access Private
const getEventStats = asyncHandler(async (req, res) => {
  const filter = eventScopeFor(req.user);

  const [totalEvents, byStatus, byService] = await Promise.all([
    Event.countDocuments(filter),
    Event.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: filter },
      { $group: { _id: '$service', count: { $sum: 1 } } },
    ]),
  ]);

  return successResponse(
    res,
    {
      totalEvents,
      byStatus: byStatus.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      byService: byService.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    },
    'Event statistics retrieved'
  );
});

// @desc Simulate events from backend services
// @route POST /api/events/simulate
// @access Private
const simulateServiceEvent = asyncHandler(async (req, res) => {
  const { serviceType } = req.body; // 'auth', 'payment', 'notification', 'system'

  let newEventData = {};
  const userId = req.user._id;

  switch (serviceType) {
    case 'payment': {
      const isSuccess = Math.random() > 0.2;
      const amount = (Math.random() * 250 + 20).toFixed(2);
      newEventData = {
        eventType: isSuccess ? 'payment.success' : 'payment.failed',
        service: 'payment-service',
        source: 'payment-gateway',
        userId,
        status: isSuccess ? 'success' : 'error',
        metadata: {
          amount: parseFloat(amount),
          currency: 'USD',
          method: 'credit_card',
          transactionId: `txn_${Math.random().toString(36).substring(2, 9)}`,
          ...(isSuccess ? {} : { error: 'Insufficient funds / Bank declined' }),
        },
      };
      break;
    }
    case 'notification': {
      newEventData = {
        eventType: 'notification.sent',
        service: 'notification-service',
        source: 'message-queue',
        userId,
        status: 'success',
        metadata: {
          channel: 'push',
          templateId: 'tpl_weekly_digest',
          deliveryLatencyMs: Math.floor(Math.random() * 200 + 50),
        },
      };
      break;
    }
    case 'system': {
      newEventData = {
        eventType: 'system.error',
        service: 'system',
        source: 'worker-node-1',
        status: 'error',
        metadata: {
          errorCode: 'ERR_HIGH_MEMORY_PRESSURE',
          memoryUsagePercent: 88.4,
          timestamp: new Date().toISOString(),
        },
      };
      break;
    }
    case 'auth':
    default: {
      newEventData = {
        eventType: 'api.request',
        service: 'api-gateway',
        source: 'edge-router',
        userId,
        status: 'info',
        metadata: {
          endpoint: '/api/v1/analytics',
          latencyMs: Math.floor(Math.random() * 80 + 20),
          statusCode: 200,
        },
      };
      break;
    }
  }

  const event = await recordEvent(newEventData);
  return successResponse(res, { event }, `Simulated event created for ${newEventData.service}`);
});

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  getEventStats,
  simulateServiceEvent,
};
