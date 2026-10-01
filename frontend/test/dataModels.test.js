// Unit tests for pure frontend data logic (no DOM). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePagination, normalizeEvent, normalizeNotificationList } from '../src/utils/records.js';
import { formatPercent, formatRelativeTime, humanizeIdentifier } from '../src/utils/formatters.js';
import { normalizeOverview, normalizeTimeline, normalizeDistributions } from '../src/features/dashboard/dashboardModel.js';
import { deriveEventOutcomes, deriveTimelineStacks, peakOf, sumSeries } from '../src/features/analytics/analyticsModel.js';
import {
  normalizeUser,
  normalizeUserPage,
  roleChangeBlockedReason,
  statusChangeBlockedReason,
} from '../src/features/users/usersModel.js';

const NOW = Date.UTC(2026, 9, 1, 15, 30);

// ---- pagination (Users crash regression) ---------------------------------

test('missing pagination normalizes to a safe default instead of crashing', () => {
  const p = normalizePagination(undefined, { page: 1, limit: 25 });
  assert.deepEqual(p, { page: 1, limit: 25, total: 0, totalPages: 1, hasPrevPage: false, hasNextPage: false });
});

test('malformed pagination fields are coerced safely', () => {
  const p = normalizePagination({ total: 'abc', page: -3, limit: 0, totalPages: null });
  assert.equal(p.page, 1);
  assert.equal(p.limit >= 1, true);
  assert.equal(p.total, 0);
});

test('out-of-range page is preserved so the page can step back', () => {
  const p = normalizePagination({ total: 10, page: 3, limit: 10, totalPages: 1 });
  assert.equal(p.page, 3);
  assert.equal(p.hasNextPage, false);
});

test('missing pagination block counts the rows actually returned', () => {
  const page = normalizeUserPage({ success: true, data: [{ _id: 'a' }, { _id: 'b' }] }, { page: 1, limit: 10 });
  assert.equal(page.pagination.total, 2);
  assert.equal(page.pagination.totalPages, 1);
  const later = normalizePagination(undefined, { page: 3, limit: 10, itemCount: 4 });
  assert.equal(later.total, 24);
  assert.equal(later.page, 3);
  // A real pagination block always wins over the row count.
  assert.equal(normalizePagination({ total: 50, page: 1, limit: 10 }, { page: 1, limit: 10, itemCount: 10 }).total, 50);
});

test('users page payload without pagination or data is safe', () => {
  const page = normalizeUserPage({ success: true }, { page: 1, limit: 10 });
  assert.deepEqual(page.items, []);
  assert.equal(page.pagination.total, 0);
  assert.equal(normalizeUserPage(null, { page: 2, limit: 10 }).pagination.page, 2);
});

// ---- users ---------------------------------------------------------------

test('normalizeUser keeps only display-safe fields (never a password)', () => {
  const user = normalizeUser({ _id: 'u1', name: ' Alex ', email: 'a@x.io', role: 'admin', status: 'suspended', password: 'hash', token: 'jwt' });
  assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'name', 'role', 'status', 'updatedAt']);
  assert.equal(user.name, 'Alex');
});

test('normalizeUser falls back safely for unknown role/status and missing name', () => {
  const user = normalizeUser({ _id: 'u2', role: 'superuser', status: 'weird' });
  assert.equal(user.role, 'user');
  assert.equal(user.status, 'active');
  assert.equal(user.name, 'Unnamed user');
});

test('role/status guards mirror backend self-protection rules', () => {
  const me = { id: 'me', role: 'admin', status: 'active' };
  const other = { id: 'other', role: 'user', status: 'active' };
  assert.match(roleChangeBlockedReason(me, 'user', 'me'), /own admin/);
  assert.match(statusChangeBlockedReason(me, 'suspended', 'me'), /own account/);
  assert.equal(roleChangeBlockedReason(other, 'admin', 'me'), null);
  assert.equal(statusChangeBlockedReason(other, 'suspended', 'me'), null);
  assert.match(roleChangeBlockedReason(other, 'user', 'me'), /different role/);
});

// ---- dashboard / analytics consistency -----------------------------------

test('sparse timelines are gap-filled for every range', () => {
  const sparse = [{ date: '2026-09-28', events: 5, errors: 1, notifications: 2, deliveredNotifications: 2 }];
  const week = normalizeTimeline(sparse, '7d', NOW);
  assert.equal(week.length, 8);
  assert.equal(week.find((p) => p.key === '2026-09-28').events, 5);
  assert.equal(week.find((p) => p.key === '2026-09-29').events, 0);
  assert.equal(normalizeTimeline([], '24h', NOW).length, 25);
  assert.equal(normalizeTimeline(null, '30d', NOW).length, 31);
});

test('overview never fabricates rates when the denominator is zero', () => {
  const o = normalizeOverview({ kpis: { totalEvents: 0, totalNotifications: 0, deliveryRate: 100 } }, { isAdmin: false });
  assert.equal(o.deliveryRate, null);
  assert.equal(o.errorRate, null);
  assert.equal(o.totalUsers, null);
});

test('event outcomes split only from real totals', () => {
  assert.deepEqual(deriveEventOutcomes({ totalEvents: 0, errorCount: 0 }), []);
  assert.deepEqual(deriveEventOutcomes({ totalEvents: 10, errorCount: 3 }), [
    { name: 'non-error', value: 7 },
    { name: 'error', value: 3 },
  ]);
  // Inconsistent API data can't produce negative counts.
  assert.deepEqual(deriveEventOutcomes({ totalEvents: 2, errorCount: 5 }), [{ name: 'error', value: 2 }]);
});

test('timeline stacks are derived without negatives', () => {
  const stacks = deriveTimelineStacks([{ key: 'k', time: 1, events: 3, errors: 5, notifications: 2, delivered: 4 }]);
  assert.deepEqual(stacks[0], { key: 'k', time: 1, errors: 5, nonErrors: 0, delivered: 2, notDelivered: 0 });
  assert.deepEqual(deriveTimelineStacks(undefined), []);
});

test('series helpers', () => {
  const rows = [{ a: 1, b: 2 }, { a: 4, b: 0 }];
  assert.deepEqual(sumSeries(rows, ['a', 'b']), { a: 5, b: 2 });
  assert.deepEqual(peakOf(rows, 'a'), rows[1]);
  assert.equal(peakOf([{ a: 0 }], 'a'), null);
});

test('distributions drop invalid and zero entries and sort descending', () => {
  const d = normalizeDistributions({ eventsByService: [{ name: 'a', value: 1 }, { name: 'b', value: 5 }, { name: null, value: 9 }, { name: 'c', value: 0 }] });
  assert.deepEqual(d.eventsByService.map((x) => x.name), ['b', 'a']);
  assert.deepEqual(d.notificationsByChannel, []);
});

// ---- records & formatting ------------------------------------------------

test('event and notification normalizers tolerate malformed records', () => {
  assert.equal(normalizeEvent({ userId: 'abc', metadata: [1] }).user.id, 'abc');
  assert.deepEqual(normalizeEvent({ metadata: [1] }).metadata, {});
  assert.equal(normalizeNotificationList([{ title: 'no id' }, { _id: 'n1' }]).length, 1);
});

test('formatting helpers', () => {
  assert.equal(humanizeIdentifier('api.request'), 'API request');
  assert.equal(formatPercent(88.64), '88.6%');
  assert.equal(formatPercent(null), '—');
  assert.equal(formatRelativeTime(NOW + 60_000, NOW), 'just now'); // slight clock skew
  assert.match(formatRelativeTime(NOW - 5 * 60_000, NOW), /5 min/);
});
