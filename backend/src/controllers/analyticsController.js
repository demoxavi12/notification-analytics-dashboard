const User = require('../models/User');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { successResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper to compute date range filter
const getDateFilter = (range) => {
  const now = new Date();
  const filter = {};

  if (range === '24h') {
    filter.$gte = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === '7d') {
    filter.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '30d') {
    filter.$gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return filter;
};

// @desc Get overview KPI metrics
// @route GET /api/analytics/overview
// @access Private
const getOverview = asyncHandler(async (req, res) => {
  const { range = '30d', service } = req.query;

  const eventMatch = {};
  const notifMatch = {};

  const dateFilter = getDateFilter(range);
  if (dateFilter.$gte) {
    eventMatch.timestamp = dateFilter;
    notifMatch.createdAt = dateFilter;
  }

  if (service && service !== 'all') {
    eventMatch.service = service;
  }

  // Regular users see only their related events/notifications
  if (req.user.role !== 'admin') {
    eventMatch.$or = [{ userId: req.user._id }, { userId: null }];
    notifMatch.recipient = req.user._id;
  }

  const [
    totalUsers,
    totalEvents,
    totalNotifications,
    notificationStats,
    errorEvents,
    apiRequests,
  ] = await Promise.all([
    req.user.role === 'admin' ? User.countDocuments() : 1,
    Event.countDocuments(eventMatch),
    Notification.countDocuments(notifMatch),
    Notification.aggregate([
      { $match: notifMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Event.countDocuments({ ...eventMatch, status: 'error' }),
    Event.countDocuments({ ...eventMatch, eventType: 'api.request' }),
  ]);

  const deliveredCount = notificationStats.find((s) => s._id === 'delivered')?.count || 0;
  const failedCount = notificationStats.find((s) => s._id === 'failed')?.count || 0;
  const deliveryRate = totalNotifications > 0 ? ((deliveredCount / totalNotifications) * 100).toFixed(1) : '100.0';

  return successResponse(
    res,
    {
      kpis: {
        totalUsers,
        totalEvents,
        totalNotifications,
        successfulNotifications: deliveredCount,
        failedNotifications: failedCount,
        deliveryRate: parseFloat(deliveryRate),
        apiRequests,
        errorCount: errorEvents,
      },
      timeframe: range,
    },
    'Overview analytics calculated'
  );
});

// @desc Get timeline / timeseries chart data
// @route GET /api/analytics/timeseries
// @access Private
const getTimeSeries = asyncHandler(async (req, res) => {
  const { range = '7d', service } = req.query;

  const eventMatch = {};
  const notifMatch = {};

  const dateFilter = getDateFilter(range);
  if (dateFilter.$gte) {
    eventMatch.timestamp = dateFilter;
    notifMatch.createdAt = dateFilter;
  }

  if (service && service !== 'all') {
    eventMatch.service = service;
  }

  if (req.user.role !== 'admin') {
    eventMatch.$or = [{ userId: req.user._id }, { userId: null }];
    notifMatch.recipient = req.user._id;
  }

  // Format string for grouping: if 24h group by hour, else by day
  const dateFormat = range === '24h' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';

  const [eventTimeline, notificationTimeline] = await Promise.all([
    Event.aggregate([
      { $match: eventMatch },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$timestamp' } },
          totalEvents: { $sum: 1 },
          errors: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
          },
          success: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Notification.aggregate([
      { $match: notifMatch },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          totalNotifications: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Merge timelines into unified chronologically sorted chart points
  const mergedMap = new Map();

  eventTimeline.forEach((item) => {
    mergedMap.set(item._id, {
      date: item._id,
      events: item.totalEvents,
      errors: item.errors,
      notifications: 0,
      deliveredNotifications: 0,
    });
  });

  notificationTimeline.forEach((item) => {
    if (mergedMap.has(item._id)) {
      const existing = mergedMap.get(item._id);
      existing.notifications = item.totalNotifications;
      existing.deliveredNotifications = item.delivered;
    } else {
      mergedMap.set(item._id, {
        date: item._id,
        events: 0,
        errors: 0,
        notifications: item.totalNotifications,
        deliveredNotifications: item.delivered,
      });
    }
  });

  const timeline = Array.from(mergedMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

  return successResponse(res, { timeline }, 'Timeseries analytics retrieved');
});

// @desc Get distributions (services, event types, channels)
// @route GET /api/analytics/distributions
// @access Private
const getDistributions = asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;

  const eventMatch = {};
  const notifMatch = {};

  const dateFilter = getDateFilter(range);
  if (dateFilter.$gte) {
    eventMatch.timestamp = dateFilter;
    notifMatch.createdAt = dateFilter;
  }

  if (req.user.role !== 'admin') {
    eventMatch.$or = [{ userId: req.user._id }, { userId: null }];
    notifMatch.recipient = req.user._id;
  }

  const [eventsByService, eventTypes, notificationsByStatus, notificationsByChannel] = await Promise.all([
    Event.aggregate([
      { $match: eventMatch },
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Event.aggregate([
      { $match: eventMatch },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Notification.aggregate([
      { $match: notifMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: notifMatch },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]),
  ]);

  return successResponse(
    res,
    {
      eventsByService: eventsByService.map((s) => ({ name: s._id, value: s.count })),
      eventTypes: eventTypes.map((t) => ({ name: t._id, value: t.count })),
      notificationsByStatus: notificationsByStatus.map((s) => ({ name: s._id, value: s.count })),
      notificationsByChannel: notificationsByChannel.map((c) => ({ name: c._id, value: c.count })),
    },
    'Distributions retrieved'
  );
});

module.exports = {
  getOverview,
  getTimeSeries,
  getDistributions,
};
