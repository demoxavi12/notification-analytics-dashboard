// DEVELOPMENT-ONLY demo data source for the dashboard.
//
// Reproduces the project's existing seed dataset (backend/src/seed/seedData.js):
// the same event templates, notification templates and generation rules, then
// aggregates them with the same formulas as backend/src/controllers/analyticsController.js.
// It is only loaded via a dynamic import behind import.meta.env.DEV, so it is not
// part of production builds. It contains no user accounts or credentials.

import { toBucketKey, DASHBOARD_RANGES } from './dashboardModel';

const DAY_MS = 24 * 3600 * 1000;
const SEED_USERS = ['admin', 'user', 'dev']; // placeholders for the 3 seeded accounts (ids only)

// Deterministic PRNG so the demo looks the same on every refresh.
const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Same pool as seedData.js serviceEventPool.
const SERVICE_EVENT_POOL = [
  { service: 'auth-service', eventType: 'user.signup', source: 'auth-api', status: 'success', metadata: { provider: 'email', platform: 'web' } },
  { service: 'auth-service', eventType: 'user.login', source: 'web-app', status: 'success', metadata: { client: 'Chrome 128' } },
  { service: 'auth-service', eventType: 'user.login.failed', source: 'web-app', status: 'warning', metadata: {} },
  { service: 'notification-service', eventType: 'notification.sent', source: 'queue-worker', status: 'info', metadata: { channel: 'email', template: 'welcome_v2' } },
  { service: 'notification-service', eventType: 'notification.delivered', source: 'smtp-relay', status: 'success', metadata: { channel: 'email', latencyMs: 142 } },
  { service: 'notification-service', eventType: 'notification.failed', source: 'fcm-provider', status: 'error', metadata: { channel: 'push', reason: 'Device token expired' } },
  { service: 'payment-service', eventType: 'payment.success', source: 'stripe-webhook', status: 'success', metadata: { amount: 49.99, currency: 'USD' } },
  { service: 'payment-service', eventType: 'payment.failed', source: 'stripe-webhook', status: 'error', metadata: { amount: 199.0, currency: 'USD', reason: 'Card declined' } },
  { service: 'api-gateway', eventType: 'api.request', source: 'envoy-proxy', status: 'info', metadata: { method: 'GET', endpoint: '/api/v1/metrics', latencyMs: 38 } },
  { service: 'system', eventType: 'system.error', source: 'background-worker', status: 'error', metadata: { error: 'Redis socket timeout', retries: 3 } },
];

// Same templates as seedData.js notificationTemplates (title/type/channel/status/read).
const NOTIFICATION_TEMPLATES = [
  { title: 'New Feature Announcement: Redis Invalidation', type: 'info', channel: 'in-app', status: 'delivered', read: false },
  { title: 'Security Alert: Login from new IP', type: 'warning', channel: 'email', status: 'delivered', read: false },
  { title: 'Monthly Subscription Renewed', type: 'success', channel: 'in-app', status: 'delivered', read: true },
  { title: 'Delivery Failure: SMS Gateway', type: 'error', channel: 'push', status: 'failed', read: false },
  { title: 'API Rate Limit Threshold', type: 'warning', channel: 'in-app', status: 'delivered', read: true },
  { title: 'Database Backup Completed', type: 'success', channel: 'in-app', status: 'delivered', read: true },
  { title: 'Webhook Endpoint Warning', type: 'error', channel: 'email', status: 'delivered', read: false },
  { title: 'Welcome to the Dashboard', type: 'info', channel: 'in-app', status: 'delivered', read: false },
];

const generateDataset = (now) => {
  const random = mulberry32(20260928);
  const pick = (list) => list[Math.floor(random() * list.length)];

  // Events: 14 days back, 6-12 per day (seedData.js rules). Timestamps are clamped
  // to "now" (the seed script can generate slightly-future times on day 0).
  const events = [];
  for (let day = 14; day >= 0; day--) {
    const countForDay = Math.floor(random() * 7) + 6;
    for (let j = 0; j < countForDay; j++) {
      const template = pick(SERVICE_EVENT_POOL);
      const owner = random() > 0.3 ? pick(SEED_USERS) : null;
      const offset = Math.floor(random() * 24) * 3600 * 1000 + Math.floor(random() * 60) * 60 * 1000;
      const timestamp = Math.min(now - day * DAY_MS + offset, now - 60 * 1000);
      events.push({
        _id: `demo-evt-${events.length}`,
        ...template,
        metadata: { ...template.metadata },
        owner,
        timestamp: new Date(timestamp).toISOString(),
      });
    }
  }

  // Notifications: 20 for the admin, 15 for the standard user (seedData.js rules).
  const notifications = [];
  const addNotifications = (count, recipient, templateOffset, maxDays, maxHours, unreadUntil) => {
    for (let i = 0; i < count; i++) {
      const template = NOTIFICATION_TEMPLATES[(i + templateOffset) % NOTIFICATION_TEMPLATES.length];
      const offset = Math.floor(random() * maxDays) * DAY_MS + Math.floor(random() * maxHours) * 3600 * 1000;
      notifications.push({
        _id: `demo-ntf-${notifications.length}`,
        ...template,
        read: i > unreadUntil ? template.read : false,
        recipient,
        createdAt: new Date(now - offset).toISOString(),
      });
    }
  };
  addNotifications(20, 'admin', 0, 10, 12, 5);
  addNotifications(15, 'user', 2, 8, 8, 3);

  return { events, notifications };
};

let dataset = null;
const getDataset = () => {
  if (!dataset) dataset = generateDataset(Date.now());
  return dataset;
};

// Role scoping mirrors the backend: admins see everything; users see their own
// events plus unowned ones, and only notifications addressed to them.
const scopeFor = (isAdmin) => ({
  events: (e) => isAdmin || e.owner === 'user' || e.owner === null,
  notifications: (n) => isAdmin || n.recipient === 'user',
  ownNotifications: (n) => n.recipient === (isAdmin ? 'admin' : 'user'),
});

const countBy = (items, key) => {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
};

// Simulated latency so loading states are visible in development.
const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export const createDemoDashboardSource = ({ isAdmin }) => {
  const scope = scopeFor(isAdmin);

  return {
    kind: 'demo',

    fetchRangeSections: async (range) => {
      await delay();
      const { events, notifications } = getDataset();
      const now = Date.now();
      const since = now - DASHBOARD_RANGES[range].durationMs;
      const bucket = DASHBOARD_RANGES[range].bucket;

      const scopedEvents = events.filter((e) => scope.events(e) && Date.parse(e.timestamp) >= since);
      const scopedNotifs = notifications.filter((n) => scope.notifications(n) && Date.parse(n.createdAt) >= since);

      const delivered = scopedNotifs.filter((n) => n.status === 'delivered').length;
      const failed = scopedNotifs.filter((n) => n.status === 'failed').length;

      const overview = {
        kpis: {
          totalUsers: isAdmin ? SEED_USERS.length : 1,
          totalEvents: scopedEvents.length,
          totalNotifications: scopedNotifs.length,
          successfulNotifications: delivered,
          failedNotifications: failed,
          deliveryRate: scopedNotifs.length ? Number(((delivered / scopedNotifs.length) * 100).toFixed(1)) : 100,
          apiRequests: scopedEvents.filter((e) => e.eventType === 'api.request').length,
          errorCount: scopedEvents.filter((e) => e.status === 'error').length,
        },
        timeframe: range,
      };

      const timelineMap = new Map();
      const point = (key) => {
        if (!timelineMap.has(key)) {
          timelineMap.set(key, { date: key, events: 0, errors: 0, notifications: 0, deliveredNotifications: 0 });
        }
        return timelineMap.get(key);
      };
      for (const e of scopedEvents) {
        const p = point(toBucketKey(e.timestamp, bucket));
        p.events += 1;
        if (e.status === 'error') p.errors += 1;
      }
      for (const n of scopedNotifs) {
        const p = point(toBucketKey(n.createdAt, bucket));
        p.notifications += 1;
        if (n.status === 'delivered') p.deliveredNotifications += 1;
      }
      const timeline = [...timelineMap.values()].sort((a, b) => (a.date > b.date ? 1 : -1));

      const distributions = {
        eventsByService: countBy(scopedEvents, 'service').sort((a, b) => b.value - a.value),
        eventTypes: countBy(scopedEvents, 'eventType').sort((a, b) => b.value - a.value).slice(0, 8),
        notificationsByStatus: countBy(scopedNotifs, 'status'),
        notificationsByChannel: countBy(scopedNotifs, 'channel'),
      };

      return {
        overview: { ok: true, data: overview },
        timeline: { ok: true, data: timeline },
        distributions: { ok: true, data: distributions },
      };
    },

    fetchRecentActivity: async () => {
      await delay();
      const { events, notifications } = getDataset();
      const byNewest = (field) => (a, b) => Date.parse(b[field]) - Date.parse(a[field]);
      return {
        events: { ok: true, data: events.filter(scope.events).sort(byNewest('timestamp')).slice(0, 6) },
        notifications: {
          ok: true,
          data: notifications.filter(scope.ownNotifications).sort(byNewest('createdAt')).slice(0, 5),
        },
      };
    },

    markNotificationRead: async (id) => {
      const target = getDataset().notifications.find((n) => n._id === id);
      if (target) target.read = true;
      return { ok: true, data: true };
    },

    simulateEvent: async () => ({
      ok: false,
      error: 'The event simulator needs the live backend; it is unavailable in demo mode.',
    }),
  };
};
