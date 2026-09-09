const Event = require('../models/Event');
const { recordEvent } = require('../services/eventService');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

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

// @desc Retrieve paginated & filtered events
// @route GET /api/events
// @access Private
const getEvents = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 15;
  const skip = (page - 1) * limit;

  const { service, status, eventType, search, startDate, endDate } = req.query;

  const query = {};

  // Role-based visibility: regular users see events related to them or general system events
  if (req.user.role !== 'admin') {
    query.$or = [{ userId: req.user._id }, { userId: null }];
  }

  if (service && service !== 'all') {
    query.service = service;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (eventType && eventType !== 'all') {
    query.eventType = eventType;
  }

  if (search) {
    query.$or = [
      { eventType: { $regex: search, $options: 'i' } },
      { source: { $regex: search, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

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
  const event = await Event.findById(req.params.id).populate('userId', 'name email role');
  if (!event) {
    return errorResponse(res, 'Event not found', 404, 'EVENT_NOT_FOUND');
  }

  // If not admin and event has a different userId, restrict access
  if (req.user.role !== 'admin' && event.userId && event.userId._id.toString() !== req.user._id.toString()) {
    return errorResponse(res, 'Access forbidden', 403, 'FORBIDDEN');
  }

  return successResponse(res, { event }, 'Event details retrieved');
});

// @desc Get event statistics summary
// @route GET /api/events/stats
// @access Private
const getEventStats = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') {
    filter.$or = [{ userId: req.user._id }, { userId: null }];
  }

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
