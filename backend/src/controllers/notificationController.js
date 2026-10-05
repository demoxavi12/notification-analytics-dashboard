const Notification = require('../models/Notification');
const { sendNotification } = require('../services/notificationService');
const { invalidateCacheFor } = require('../middleware/cache');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  queryString,
  escapeRegex,
  parsePagination,
  isObjectId,
  stringField,
  metadataField,
} = require('../utils/queryInput');

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'];
const NOTIFICATION_CHANNELS = ['email', 'push', 'in-app'];
const DELIVERY_STATUSES = ['pending', 'delivered', 'failed'];
const MESSAGE_MAX_LENGTH = 2000;

// Optional enum field: undefined passes (caller applies the default).
const enumError = (value, allowed, field) =>
  value !== undefined && !allowed.includes(value) ? `Invalid ${field}. Must be one of: ${allowed.join(', ')}` : null;
const { resolveTargetUser } = require('../utils/targetUser');

// @desc Create a new notification
// @route POST /api/notifications
// @access Private. Non-admins may only notify themselves (the "test notification"
//         flow) and cannot set the delivery status; admins may dispatch to any
//         existing user with any status.
const createNotification = asyncHandler(async (req, res) => {
  const { recipient, type, channel, status } = req.body;

  if (!req.body.title || !req.body.message) {
    return errorResponse(res, 'Title and message are required', 400, 'MISSING_FIELDS');
  }

  const title = stringField(req.body.title, { field: 'title', max: 200, required: true });
  const message = stringField(req.body.message, { field: 'message', max: MESSAGE_MAX_LENGTH, required: true });
  const metadata = metadataField(req.body.metadata);
  const invalid =
    title.error ||
    message.error ||
    metadata.error ||
    enumError(type, NOTIFICATION_TYPES, 'type') ||
    enumError(channel, NOTIFICATION_CHANNELS, 'channel');
  if (invalid) {
    return errorResponse(res, invalid, 400, 'VALIDATION_ERROR');
  }

  // Delivery status is an outcome recorded by the system, not user input: a forged
  // "failed"/"pending" would distort delivery metrics (including the admin view).
  if (status !== undefined && req.user.role !== 'admin') {
    return errorResponse(res, 'Only administrators can set a notification delivery status', 403, 'FORBIDDEN_FIELD');
  }
  const statusError = enumError(status, DELIVERY_STATUSES, 'status');
  if (statusError) {
    return errorResponse(res, statusError, 400, 'VALIDATION_ERROR');
  }

  // Recipient defaults to the requesting user if not provided.
  const target = await resolveTargetUser(req, recipient, { field: 'recipient' });
  if (target.error) {
    return errorResponse(res, target.error.message, target.error.status, target.error.code);
  }

  const notification = await sendNotification({
    recipient: target.userId,
    title: title.value,
    message: message.value,
    type: type || 'info',
    channel: channel || 'in-app',
    status: status || 'delivered',
    metadata: metadata.value,
  });

  return successResponse(res, { notification }, 'Notification created successfully', 201);
});

// @desc Get notifications for the authenticated user (or all if admin)
// @route GET /api/notifications
// @access Private
const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  // Strings only: arrays/objects in filters are ignored rather than becoming $in/operators.
  const read = queryString(req.query.read);
  const type = queryString(req.query.type);
  const channel = queryString(req.query.channel);
  const status = queryString(req.query.status);
  const search = queryString(req.query.search);

  const query = {};

  // Regular users only see their own notifications
  if (req.user.role !== 'admin' || req.query.selfOnly === 'true') {
    query.recipient = req.user._id;
  } else if (req.query.recipient !== undefined) {
    if (!isObjectId(req.query.recipient)) {
      return errorResponse(res, 'Invalid format for field: recipient', 400, 'INVALID_ID_FORMAT');
    }
    query.recipient = req.query.recipient;
  }

  if (read && read !== 'all') {
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

  await invalidateCacheFor({ userIds: [notification.recipient] });

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

  if (result.modifiedCount > 0) {
    await invalidateCacheFor({ userIds: [req.user._id] });
  }

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

  await invalidateCacheFor({ userIds: [notification.recipient] });

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
