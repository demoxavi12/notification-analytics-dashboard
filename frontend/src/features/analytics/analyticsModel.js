// Pure analytics derivations. Everything here is computed from fields the API
// actually returns (see backend/src/controllers/analyticsController.js); nothing is
// estimated or invented. Relative imports use explicit .js extensions so these
// modules can be unit-tested with Node's built-in test runner.

import { DASHBOARD_RANGES } from '../dashboard/dashboardModel.js';
import { EVENT_SERVICES } from '../../utils/domainLabels.js';

export const ANALYTICS_FILTER_SCHEMA = {
  range: { default: '7d', values: Object.keys(DASHBOARD_RANGES) },
  service: { default: 'all', values: ['all', ...Object.keys(EVENT_SERVICES)] },
};

// Event outcome split from overview KPIs. The API exposes the error count but not a
// per-status breakdown for the range, so the honest split is "error" vs "not an
// error" (success, info and warning combined). Empty when there are no events.
export const deriveEventOutcomes = (overview) => {
  if (!overview || overview.totalEvents <= 0) return [];
  const errors = Math.min(overview.errorCount, overview.totalEvents);
  return [
    { name: 'non-error', value: overview.totalEvents - errors },
    { name: 'error', value: errors },
  ].filter((item) => item.value > 0);
};

// Per-bucket stacks for the outcome/delivery charts, derived from the gap-filled
// timeline (normalizeTimeline). Values never go negative even if the API is inconsistent.
export const deriveTimelineStacks = (timeline) =>
  (timeline || []).map((point) => ({
    key: point.key,
    time: point.time,
    errors: point.errors,
    nonErrors: Math.max(point.events - point.errors, 0),
    delivered: Math.min(point.delivered, point.notifications),
    notDelivered: Math.max(point.notifications - point.delivered, 0),
  }));

export const sumSeries = (rows, keys) => {
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows || []) for (const k of keys) totals[k] += row[k] || 0;
  return totals;
};

// Busiest bucket by a given field, or null when every bucket is zero.
export const peakOf = (rows, field) => {
  let peak = null;
  for (const row of rows || []) if ((row[field] || 0) > (peak?.[field] || 0)) peak = row;
  return peak;
};
