import { analyticsApi } from '../../services/api';
import { normalizeDistributions, normalizeOverview, normalizeTimeline } from '../dashboard/dashboardModel';

// Analytics data source. Same endpoints and normalizers as the Dashboard, so both
// pages show identical numbers for the same range. Each section is fetched on its own
// so a failure in one doesn't blank the others, and changing the service filter only
// refetches the endpoints that accept it (overview + timeseries).
//
// Contract notes (backend/src/controllers/analyticsController.js):
//   overview, timeseries: ?range=24h|7d|30d&service=<event service> — `service` only
//     narrows EVENT figures; notification figures are never service-filtered.
//   distributions: ?range only (no service filter).

const serviceParam = (service) => (service && service !== 'all' ? service : undefined);

export const fetchAnalyticsOverview = async ({ range, service, isAdmin }, { signal } = {}) => {
  const res = await analyticsApi.getOverview({ range, service: serviceParam(service) }, { signal });
  return normalizeOverview(res.data?.data, { isAdmin });
};

export const fetchAnalyticsTimeline = async ({ range, service }, { signal } = {}) => {
  const res = await analyticsApi.getTimeSeries({ range, service: serviceParam(service) }, { signal });
  return { range, points: normalizeTimeline(res.data?.data?.timeline, range) };
};

export const fetchAnalyticsDistributions = async ({ range }, { signal } = {}) => {
  const res = await analyticsApi.getDistributions({ range }, { signal });
  return normalizeDistributions(res.data?.data);
};
