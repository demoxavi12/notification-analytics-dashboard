// Display labels/colors for the backend's enum values (see backend/src/models/Event.js
// and Notification.js). Every value the API can return is listed here, so filters and
// badges never invent values the backend doesn't support.

export const EVENT_SERVICES = {
  'auth-service': { label: 'Auth service', color: '#3b82f6' },
  'notification-service': { label: 'Notification service', color: '#10b981' },
  'payment-service': { label: 'Payment service', color: '#8b5cf6' },
  'api-gateway': { label: 'API gateway', color: '#06b6d4' },
  system: { label: 'System', color: '#ef4444' },
};

export const EVENT_STATUSES = {
  success: { label: 'Success' },
  info: { label: 'Info' },
  warning: { label: 'Warning' },
  error: { label: 'Error' },
};

export const NOTIFICATION_TYPES = {
  info: { label: 'Info' },
  success: { label: 'Success' },
  warning: { label: 'Warning' },
  error: { label: 'Error' },
};

export const NOTIFICATION_CHANNELS = {
  'in-app': { label: 'In-app', color: '#06b6d4' },
  email: { label: 'Email', color: '#3b82f6' },
  push: { label: 'Push', color: '#8b5cf6' },
};

export const DELIVERY_STATUSES = {
  delivered: { label: 'Delivered', color: 'var(--success)' },
  pending: { label: 'Pending', color: 'var(--warning)' },
  failed: { label: 'Failed', color: 'var(--error)' },
};

export const labelFor = (map, value, fallback) => map[value]?.label ?? fallback ?? value ?? 'Unknown';
export const colorFor = (map, value, fallback = '#64748b') => map[value]?.color ?? fallback;
