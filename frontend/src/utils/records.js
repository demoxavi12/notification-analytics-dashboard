// Normalizers for Event / Notification documents as returned by the API
// (GET /events, GET /notifications). UI components only consume these shapes.

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// `userId` / `recipient` are populated with { name, email } by the list endpoints,
// but may also be a bare id or null (system events).
const normalizePerson = (value) => {
  if (!value) return null;
  if (isPlainObject(value)) {
    return { id: value._id ?? null, name: value.name || null, email: value.email || null };
  }
  return { id: String(value), name: null, email: null };
};

export const normalizeEvent = (event) => ({
  id: event?._id ?? `${event?.eventType}-${event?.timestamp}`,
  type: event?.eventType || 'unknown',
  service: event?.service || 'unknown',
  source: event?.source || null,
  status: event?.status || 'info',
  timestamp: event?.timestamp || event?.createdAt || null,
  latencyMs: Number.isFinite(event?.metadata?.latencyMs) ? event.metadata.latencyMs : null,
  metadata: isPlainObject(event?.metadata) ? event.metadata : {},
  user: normalizePerson(event?.userId),
});

export const normalizeNotification = (notification) => ({
  id: notification?._id,
  title: notification?.title || 'Untitled notification',
  message: notification?.message || '',
  type: notification?.type || 'info',
  channel: notification?.channel || 'in-app',
  status: notification?.status || 'delivered',
  read: Boolean(notification?.read),
  createdAt: notification?.createdAt || null,
  updatedAt: notification?.updatedAt || null,
  metadata: isPlainObject(notification?.metadata) ? notification.metadata : {},
  recipient: normalizePerson(notification?.recipient),
});

export const normalizeEventList = (list) => (Array.isArray(list) ? list.map(normalizeEvent) : []);
export const normalizeNotificationList = (list) =>
  (Array.isArray(list) ? list.map(normalizeNotification) : []).filter((n) => n.id);

// Pagination block from paginatedResponse(); tolerant of missing/partial data.
export const normalizePagination = (pagination, fallback = {}) => {
  const toInt = (value, dflt) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : dflt;
  };
  const limit = Math.max(toInt(pagination?.limit, fallback.limit ?? 10), 1);
  const total = toInt(pagination?.total, 0);
  const totalPages = Math.max(toInt(pagination?.totalPages, Math.ceil(total / limit)), 1);
  // Not clamped to totalPages: an out-of-range page (e.g. after deleting the last item
  // on the final page) must stay visible so the caller can move back a page.
  const page = Math.max(toInt(pagination?.page, fallback.page ?? 1), 1);
  return {
    page,
    limit,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };
};
