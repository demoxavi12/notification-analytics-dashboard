import { eventsApi } from '../../services/api';
import { normalizeEventList, normalizePagination } from '../../utils/records';
import { EVENT_SERVICES, EVENT_STATUSES } from '../../utils/domainLabels';

// Filters supported by GET /events (backend/src/controllers/eventController.js#getEvents):
//   search (regex on eventType + source), service, status, startDate/endDate, page, limit.
// The time window is expressed as a relative range and converted to startDate at
// request time, so "last 24h" stays relative when the page is reloaded.
export const EVENT_TIME_RANGES = {
  all: { label: 'Any time', ms: null },
  '1h': { label: 'Last hour', ms: 3600 * 1000 },
  '24h': { label: 'Last 24 hours', ms: 24 * 3600 * 1000 },
  '7d': { label: 'Last 7 days', ms: 7 * 24 * 3600 * 1000 },
  '30d': { label: 'Last 30 days', ms: 30 * 24 * 3600 * 1000 },
};

export const EVENT_PAGE_SIZES = [10, 25, 50];

export const EVENT_FILTER_SCHEMA = {
  q: { default: '', type: 'text' },
  service: { default: 'all', values: ['all', ...Object.keys(EVENT_SERVICES)] },
  status: { default: 'all', values: ['all', ...Object.keys(EVENT_STATUSES)] },
  range: { default: 'all', values: Object.keys(EVENT_TIME_RANGES) },
  page: { default: 1, type: 'page' },
  limit: { default: '10', values: EVENT_PAGE_SIZES.map(String) },
};

// Stable module-level function (usePaginatedQuery refetches when the fetcher changes).
export const fetchEvents = async (filters, { signal } = {}) => {
  const rangeMs = EVENT_TIME_RANGES[filters.range]?.ms;
  const params = {
    page: filters.page,
    limit: Number(filters.limit),
    search: filters.q || undefined,
    service: filters.service !== 'all' ? filters.service : undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    startDate: rangeMs ? new Date(Date.now() - rangeMs).toISOString() : undefined,
  };
  const res = await eventsApi.getEvents(params, { signal });
  return {
    items: normalizeEventList(res.data?.data),
    pagination: normalizePagination(res.data?.pagination, { page: filters.page, limit: params.limit }),
  };
};

export const ingestEvent = (payload) => eventsApi.createEvent(payload);
