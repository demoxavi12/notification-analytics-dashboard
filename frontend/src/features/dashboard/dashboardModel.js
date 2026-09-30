// Dashboard view model: turns raw API payloads (or demo payloads with the same
// shape) into the plain objects the dashboard UI renders. The UI never reads API
// responses directly, so the data source can change without touching components.

export const DASHBOARD_RANGES = {
  '24h': { label: '24h', description: 'Last 24 hours', bucket: 'hour', durationMs: 24 * 3600 * 1000 },
  '7d': { label: '7d', description: 'Last 7 days', bucket: 'day', durationMs: 7 * 24 * 3600 * 1000 },
  '30d': { label: '30d', description: 'Last 30 days', bucket: 'day', durationMs: 30 * 24 * 3600 * 1000 },
};

export const DEFAULT_RANGE = '7d';

const toCount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

// ---- Time buckets --------------------------------------------------------
// The backend groups by UTC keys: "YYYY-MM-DD" (day) or "YYYY-MM-DD HH:00" (hour),
// and omits buckets with no activity. We rebuild the full series so quiet periods
// show as zero instead of disappearing from the chart.

const pad = (n) => String(n).padStart(2, '0');

export const toBucketKey = (date, bucket) => {
  const d = date instanceof Date ? date : new Date(date);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return bucket === 'hour' ? `${day} ${pad(d.getUTCHours())}:00` : day;
};

export const bucketKeyToTime = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):00)?$/.exec(key || '');
  if (!match) return null;
  const [, y, m, d, h] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), h ? Number(h) : 0);
};

const buildBucketKeys = (range, now) => {
  const { bucket, durationMs } = DASHBOARD_RANGES[range];
  const stepMs = bucket === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000;
  const keys = [];
  // Walk from the start of the window to now; the Set handles duplicate keys.
  for (let t = now - durationMs; t <= now; t += stepMs) keys.push(toBucketKey(t, bucket));
  keys.push(toBucketKey(now, bucket));
  return [...new Set(keys)];
};

export const normalizeTimeline = (rawTimeline, range, now = Date.now()) => {
  const byKey = new Map();
  for (const point of Array.isArray(rawTimeline) ? rawTimeline : []) {
    if (point?.date) byKey.set(point.date, point);
  }

  // Union of the expected window and whatever the server returned, in time order.
  const keys = [...new Set([...buildBucketKeys(range, now), ...byKey.keys()])]
    .map((key) => ({ key, time: bucketKeyToTime(key) }))
    .filter((entry) => entry.time !== null)
    .sort((a, b) => a.time - b.time);

  return keys.map(({ key, time }) => {
    const point = byKey.get(key) || {};
    return {
      key,
      time,
      events: toCount(point.events),
      errors: toCount(point.errors),
      notifications: toCount(point.notifications),
      delivered: toCount(point.deliveredNotifications),
    };
  });
};

// ---- Overview KPIs -------------------------------------------------------

export const normalizeOverview = (payload, { isAdmin }) => {
  const kpis = payload?.kpis || {};
  const totalEvents = toCount(kpis.totalEvents);
  const errorCount = toCount(kpis.errorCount);
  const totalNotifications = toCount(kpis.totalNotifications);
  const delivered = toCount(kpis.successfulNotifications);
  const failed = toCount(kpis.failedNotifications);

  return {
    totalEvents,
    errorCount,
    // null = "not meaningful" (no events), rendered as "—" rather than a fake 0%.
    errorRate: totalEvents > 0 ? (errorCount / totalEvents) * 100 : null,
    totalNotifications,
    delivered,
    failed,
    pending: Math.max(totalNotifications - delivered - failed, 0),
    // The API reports 100% when nothing was sent; that is not a real success rate.
    deliveryRate: totalNotifications > 0 ? (delivered / totalNotifications) * 100 : null,
    apiRequests: toCount(kpis.apiRequests),
    // Non-admin responses hard-code totalUsers to 1, so it is only meaningful for admins.
    totalUsers: isAdmin ? toCount(kpis.totalUsers) : null,
  };
};

// ---- Distributions -------------------------------------------------------

const normalizeSeries = (series) =>
  (Array.isArray(series) ? series : [])
    .filter((item) => item && item.name)
    .map((item) => ({ name: String(item.name), value: toCount(item.value) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

export const normalizeDistributions = (payload) => ({
  eventsByService: normalizeSeries(payload?.eventsByService),
  eventTypes: normalizeSeries(payload?.eventTypes),
  notificationsByStatus: normalizeSeries(payload?.notificationsByStatus),
  notificationsByChannel: normalizeSeries(payload?.notificationsByChannel),
});

// ---- Recent activity -----------------------------------------------------
// Record normalizers are shared with the Events/Notifications pages.
export {
  normalizeEvent,
  normalizeNotification,
  normalizeEventList,
  normalizeNotificationList,
} from '../../utils/records';
