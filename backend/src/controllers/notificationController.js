const Notification = require('../models/Notification');
const { sendNotification } = require('../services/notificationService');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { queryString, escapeRegex } = require('../utils/queryInput');

// @desc Create a new notification
// @route POST /api/notifications
// @access Private (Admin or internal service)
const createNotification = asyncHandler(async (req, res) => {
  const { recipient, title, message, type, channel, status, metadata } = req.body;

  if (!title || !message) {
    return errorResponse(res, 'Title and message are required', 400, 'MISSING_FIELDS');
  }

  // Recipient defaults to the requesting user if not provided
  const targetRecipient = recipient || req.user._id;

  const notification = await sendNotification({
    recipient: targetRecipient,
    title,
    message,
    type: type || 'info',
    channel: channel || 'in-app',
    status: status || 'delivered',
    metadata: metadata || {},
  });

  return successResponse(res, { notification }, 'Notification created successfully', 201);
});

// @desc Get notifications for the authenticated user (or all if admin)
// @route GET /api/notifications
// @access Private
const getNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { read, type, channel, status } = req.query;
  const search = queryString(req.query.search);

  const query = {};

  // Regular users only see their own notifications
  if (req.user.role !== 'admin' || req.query.selfOnly === 'true') {
    query.recipient = req.user._id;
  } else if (req.query.recipient) {
    query.recipient = req.query.recipient;
  }

  if (read !== undefined && read !== 'all') {
    query.read = read === 'true';
  }

  if (type && type !== 'all') {
    query.type = type;
  }

  if (channel && channel !== 'all') {
    query.channel = channel;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    // Plain-text match (same approach as event search). Ownership scoping is set on
    // query.recipient above and is unaffected by this $or.
    const pattern = escapeRegex(search);
    query.$or = [
      { title: { $regex: pattern, $options: 'i' } },
      { message: { $regex: pattern, $options: 'i' } },
    ];
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query),
    Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    }),
  ]);

  const response = {
    success: true,
    message: 'Notifications retrieved successfully',
    data: notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };

  return res.status(200).json(response);
});

// @desc Mark a notification as read
// @route PATCH /api/notifications/:id/read
// @access Private
const markAsRead = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };

  // If not admin, restrict to notifications owned by the user
  if (req.user.role !== 'admin') {
    query.recipient = req.user._id;
  }

  const notification = await Notification.findOneAndUpdate(
    query,
    { read: true },
    { new: true }
  );

  if (!notification) {
    return errorResponse(res, 'Notification not found or unauthorized', 404, 'NOT_FOUND');
  }

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    read: false,
  });

  return successResponse(res, { notification, unreadCount }, 'Notification marked as read');
});

// @desc Mark all notifications as read for current user
// @route PATCH /api/notifications/read-all
// @access Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } }
  );

  return successResponse(
    res,
    { modifiedCount: result.modifiedCount, unreadCount: 0 },
    'All notifications marked as read'
  );
});

// @desc Get notification summary statistics
// @route GET /api/notifications/stats
// @access Private
const getNotificationStats = asyncHandler(async (req, res) => {
  const matchFilter = {};
  if (req.user.role !== 'admin') {
    matchFilter.recipient = req.user._id;
  }

  const [total, unread, byStatus, byChannel, byType] = await Promise.all([
    Notification.countDocuments(matchFilter),
    Notification.countDocuments({ ...matchFilter, read: false }),
    Notification.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  return successResponse(
    res,
    {
      total,
      unread,
      delivered: byStatus.find((s) => s._id === 'delivered')?.count || 0,
      failed: byStatus.find((s) => s._id === 'failed')?.count || 0,
      pending: byStatus.find((s) => s._id === 'pending')?.count || 0,
      byChannel: byChannel.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      byType: byType.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    },
    'Notification statistics retrieved'
  );
});

// @desc Delete a notification
// @route DELETE /api/notifications/:id
// @access Private
const deleteNotification = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role !== 'admin') {
    query.recipient = req.user._id;
  }

  const notification = await Notification.findOneAndDelete(query);
  if (!notification) {
    return errorResponse(res, 'Notification not found or unauthorized', 404, 'NOT_FOUND');
  }

  return successResponse(res, null, 'Notification deleted successfully');
});

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationStats,
  deleteNotification,
};
