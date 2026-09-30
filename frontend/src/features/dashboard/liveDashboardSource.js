import { analyticsApi, eventsApi, getApiErrorMessage, notificationsApi } from '../../services/api';

// Live data source backed by the existing REST contracts:
//   GET /analytics/overview|timeseries|distributions?range=24h|7d|30d
//   GET /events?limit=N, GET /notifications?limit=N
//   PATCH /notifications/:id/read, POST /events/simulate
// Every method resolves (never rejects) with { ok, data } or { ok: false, error },
// so one failing endpoint can't take down the other dashboard sections.

const RECENT_EVENTS_LIMIT = 6;
const RECENT_NOTIFICATIONS_LIMIT = 5;

const settle = async (request, pick, fallbackMessage) => {
  try {
    const res = await request();
    return { ok: true, data: pick(res.data) };
  } catch (err) {
    return {
      ok: false,
      error: getApiErrorMessage(err, fallbackMessage),
      // No HTTP response at all = backend unreachable (enables the dev demo fallback).
      isNetworkError: Boolean(err?.isAxiosError && !err.response),
    };
  }
};

export const liveDashboardSource = {
  kind: 'live',

  fetchRangeSections: async (range) => {
    const [overview, timeline, distributions] = await Promise.all([
      settle(() => analyticsApi.getOverview({ range }), (body) => body?.data, 'Could not load summary metrics.'),
      settle(() => analyticsApi.getTimeSeries({ range }), (body) => body?.data?.timeline, 'Could not load activity.'),
      settle(() => analyticsApi.getDistributions({ range }), (body) => body?.data, 'Could not load breakdowns.'),
    ]);
    return { overview, timeline, distributions };
  },

  fetchRecentActivity: async () => {
    const [events, notifications] = await Promise.all([
      settle(() => eventsApi.getEvents({ limit: RECENT_EVENTS_LIMIT }), (body) => body?.data, 'Could not load recent events.'),
      settle(
        () => notificationsApi.getNotifications({ limit: RECENT_NOTIFICATIONS_LIMIT }),
        (body) => body?.data,
        'Could not load recent notifications.'
      ),
    ]);
    return { events, notifications };
  },

  markNotificationRead: (id) =>
    settle(() => notificationsApi.markAsRead(id), () => true, 'Could not mark the notification as read.'),

  simulateEvent: (serviceType) =>
    settle(() => eventsApi.simulateEvent(serviceType), (body) => body?.data, 'Event simulation failed.'),
};
