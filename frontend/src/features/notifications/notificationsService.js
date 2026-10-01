import { notificationsApi } from '../../services/api';
import { normalizeNotification, normalizeNotificationList, normalizePagination } from '../../utils/records';
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../../utils/domainLabels';

// Filters supported by GET /notifications (backend/src/controllers/notificationController.js):
//   search (title/message), read (true|false), type, channel, status, page, limit,
//   selfOnly=true (admins only; non-admins are always limited to their own).
export const NOTIFICATION_PAGE_SIZES = [10, 25, 50];

export const NOTIFICATION_FILTER_SCHEMA = {
  q: { default: '', type: 'text' },
  read: { default: 'all', values: ['all', 'false', 'true'] },
  type: { default: 'all', values: ['all', ...Object.keys(NOTIFICATION_TYPES)] },
  channel: { default: 'all', values: ['all', ...Object.keys(NOTIFICATION_CHANNELS)] },
  status: { default: 'all', values: ['all', ...Object.keys(DELIVERY_STATUSES)] },
  scope: { default: 'all', values: ['all', 'mine'] },
  page: { default: 1, type: 'page' },
  limit: { default: '10', values: NOTIFICATION_PAGE_SIZES.map(String) },
};

const orUndefined = (value) => (value && value !== 'all' ? value : undefined);

export const fetchNotifications = async (filters, { signal } = {}) => {
  const params = {
    page: filters.page,
    limit: Number(filters.limit),
    search: filters.q || undefined,
    read: orUndefined(filters.read),
    type: orUndefined(filters.type),
    channel: orUndefined(filters.channel),
    status: orUndefined(filters.status),
    // Only admins can widen the scope server-side; for everyone else the backend
    // ignores this and always returns their own notifications.
    selfOnly: filters.scope === 'mine' ? 'true' : undefined,
  };
  const res = await notificationsApi.getNotifications(params, { signal });
  const unread = Number(res.data?.unreadCount);
  const items = normalizeNotificationList(res.data?.data);
  return {
    items,
    pagination: normalizePagination(res.data?.pagination, { page: filters.page, limit: params.limit, itemCount: items.length }),
    // unreadCount is always the *current user's* unread total (not the filtered list).
    unreadCount: Number.isFinite(unread) ? unread : null,
  };
};

export const markNotificationRead = async (id) => {
  const res = await notificationsApi.markAsRead(id);
  const unread = Number(res.data?.data?.unreadCount);
  return {
    notification: res.data?.data?.notification ? normalizeNotification(res.data.data.notification) : null,
    unreadCount: Number.isFinite(unread) ? unread : null,
  };
};

export const markAllNotificationsRead = () => notificationsApi.markAllAsRead();
export const deleteNotification = (id) => notificationsApi.deleteNotification(id);
export const sendTestNotification = (payload) => notificationsApi.createNotification(payload);
