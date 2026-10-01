import { useMemo } from 'react';
import { Activity, AlertTriangle, Bell, CheckCircle2, Globe, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import useUrlFilters from '../hooks/useUrlFilters';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import { DASHBOARD_RANGES } from '../features/dashboard/dashboardModel';
import {
  ANALYTICS_FILTER_SCHEMA,
  deriveEventOutcomes,
  deriveTimelineStacks,
  peakOf,
  sumSeries,
} from '../features/analytics/analyticsModel';
import {
  fetchAnalyticsDistributions,
  fetchAnalyticsOverview,
  fetchAnalyticsTimeline,
} from '../features/analytics/analyticsService';
import { DELIVERY_STATUSES, EVENT_SERVICES, NOTIFICATION_CHANNELS, colorFor, labelFor } from '../utils/domainLabels';
import { formatCount, formatPercent, humanizeIdentifier } from '../utils/formatters';
import { formatBucket } from '../utils/chartFormat';
import KPICard from '../components/common/KPICard';
import FilterSelect from '../components/common/FilterSelect';
import StateMessage from '../components/common/StateMessage';
import DashboardSection from '../components/dashboard/DashboardSection';
import ActivityChart from '../components/dashboard/ActivityChart';
import BreakdownList from '../components/dashboard/BreakdownList';
import RangeSelector from '../components/dashboard/RangeSelector';
import StackedBarChart from '../components/charts/StackedBarChart';
import useDocumentTitle from '../hooks/useDocumentTitle';

const SERVICE_OPTIONS = [
  { value: 'all', label: 'All services' },
  ...Object.entries(EVENT_SERVICES).map(([value, { label }]) => ({ value, label })),
];

const OUTCOME_SERIES = [
  { key: 'nonErrors', label: 'Non-error', color: '#3b82f6' },
  { key: 'errors', label: 'Errors', color: '#ef4444' },
];
const DELIVERY_SERIES = [
  { key: 'delivered', label: 'Delivered', color: '#10b981' },
  { key: 'notDelivered', label: 'Not delivered (pending or failed)', color: '#f59e0b' },
];
const OUTCOME_LABELS = { error: 'Error', 'non-error': 'Non-error (success, info, warning)' };
const OUTCOME_COLORS = { error: '#ef4444', 'non-error': '#3b82f6' };

const ChartSkeleton = () => <div className="skeleton skeleton-chart" />;
const ListSkeleton = ({ rows = 4 }) => (
  <div className="skeleton-list">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </div>
);

// Text alternative for a stacked chart: totals per series and the busiest bucket.
const stackSummary = (rows, series, bucket, rangeDescription, totalField) => {
  const totals = sumSeries(rows, series.map((s) => s.key));
  const parts = series.map((s) => `${formatCount(totals[s.key])} ${s.label.toLowerCase()}`).join(', ');
  const withTotals = (rows || []).map((r) => ({ ...r, [totalField]: series.reduce((sum, s) => sum + r[s.key], 0) }));
  const peak = peakOf(withTotals, totalField);
  const peakText = peak
    ? ` Busiest period: ${formatBucket(peak.time, bucket, true)} with ${formatCount(peak[totalField])} ${totalField}.`
    : '';
  return `${rangeDescription}: ${parts}.${peakText}`;
};

const AnalyticsPage = () => {
  useDocumentTitle('Analytics');
  const { isAdmin } = useAuth();
  const { filters, updateFilters } = useUrlFilters(ANALYTICS_FILTER_SCHEMA);
  const { range, service } = filters;

  // Separate params per endpoint so a service change doesn't refetch distributions.
  const overviewParams = useMemo(() => ({ range, service, isAdmin }), [range, service, isAdmin]);
  const timelineParams = useMemo(() => ({ range, service }), [range, service]);
  const distributionParams = useMemo(() => ({ range }), [range]);

  const overviewQuery = usePaginatedQuery(fetchAnalyticsOverview, overviewParams, 'Could not load summary metrics.');
  const timelineQuery = usePaginatedQuery(fetchAnalyticsTimeline, timelineParams, 'Could not load activity.');
  const distributionQuery = usePaginatedQuery(fetchAnalyticsDistributions, distributionParams, 'Could not load breakdowns.');

  const queries = [overviewQuery, timelineQuery, distributionQuery];
  const isRefreshing = queries.some((q) => q.status === 'loading');
  const refreshAll = () => queries.forEach((q) => q.reload());

  // The chart labels must match the range the data was fetched for, not the one
  // just selected (old data stays visible, dimmed, while the new range loads).
  const timeline = timelineQuery.data;
  const loadedRangeInfo = DASHBOARD_RANGES[timeline?.range || range];
  const rangeInfo = DASHBOARD_RANGES[range];
  const serviceLabel = service === 'all' ? null : EVENT_SERVICES[service].label;
  const scopeNote = isAdmin ? 'All users' : 'Your events and notifications';

  const overview = overviewQuery.data;
  const distributions = distributionQuery.data;
  const stacks = useMemo(() => deriveTimelineStacks(timeline?.points), [timeline]);
  const outcomes = useMemo(() => deriveEventOutcomes(overview), [overview]);

  const activityEmpty = !!timeline && timeline.points.every((p) => !p.events && !p.notifications && !p.errors);
  const outcomesEmpty = !!timeline && stacks.every((p) => !p.errors && !p.nonErrors);
  const deliveryEmpty = !!timeline && stacks.every((p) => !p.delivered && !p.notDelivered);

  const kpis = useMemo(() => {
    if (!overview) return [];
    const eventScope = serviceLabel ? serviceLabel : 'All services';
    return [
      {
        id: 'events',
        label: 'Events',
        value: formatCount(overview.totalEvents),
        subtext: eventScope,
        icon: Activity,
        color: '#3b82f6',
      },
      {
        id: 'errors',
        label: 'Error events',
        value: formatCount(overview.errorCount),
        subtext: overview.errorRate === null ? 'No events to evaluate' : `${formatPercent(overview.errorRate)} error rate`,
        subtextTone: overview.errorCount > 0 ? 'error' : undefined,
        icon: AlertTriangle,
        color: '#ef4444',
      },
      {
        id: 'non-errors',
        label: 'Non-error events',
        value: formatCount(Math.max(overview.totalEvents - overview.errorCount, 0)),
        subtext: 'Success, info and warning',
        icon: ShieldCheck,
        color: '#10b981',
      },
      {
        id: 'api',
        label: 'API requests',
        value: formatCount(overview.apiRequests),
        subtext: eventScope,
        icon: Globe,
        color: '#06b6d4',
      },
      {
        id: 'notifications',
        label: 'Notifications sent',
        value: formatCount(overview.totalNotifications),
        subtext:
          overview.totalNotifications > 0
            ? `${formatCount(overview.delivered)} delivered · ${formatCount(overview.pending)} pending`
            : 'None in this period',
        icon: Bell,
        color: '#8b5cf6',
      },
      {
        id: 'delivery',
        label: 'Delivery success',
        value: overview.deliveryRate === null ? '—' : formatPercent(overview.deliveryRate),
        subtext:
          overview.deliveryRate === null
            ? 'No deliveries to measure'
            : `${formatCount(overview.failed)} failed deliver${overview.failed === 1 ? 'y' : 'ies'}`,
        subtextTone: overview.failed > 0 ? 'warning' : undefined,
        icon: CheckCircle2,
        color: '#10b981',
      },
    ];
  }, [overview, serviceLabel]);

  const allServicesNote = serviceLabel ? ' · all services (not filterable)' : '';
  const rangeLower = loadedRangeInfo.description.toLowerCase();

  return (
    <div className="dashboard analytics">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics &amp; Intelligence</h1>
          <p className="page-subtitle">Event volume, outcomes, notification delivery and service distribution</p>
        </div>
        <div className="dashboard-controls">
          <RangeSelector value={range} options={DASHBOARD_RANGES} onChange={(next) => updateFilters({ range: next })} />
          <FilterSelect label="Service" value={service} options={SERVICE_OPTIONS} onChange={(next) => updateFilters({ service: next })} />
          <button
            type="button"
            onClick={refreshAll}
            className="btn btn-secondary btn-sm analytics-refresh"
            disabled={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing analytics' : 'Refresh analytics'}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : undefined} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <p className="dashboard-updated">
        {rangeInfo.description} · {scopeNote}
        {serviceLabel && ` · Event figures filtered to ${serviceLabel}; notification figures cover all services`}
      </p>

      {/* KPIs */}
      <section aria-labelledby="analytics-kpi-heading" className="dashboard-kpis">
        <h2 id="analytics-kpi-heading" className="sr-only">
          Key metrics
        </h2>
        {overviewQuery.status === 'error' ? (
          <StateMessage
            tone="error"
            className="card"
            title="Couldn’t load summary metrics"
            message={overviewQuery.error}
            onRetry={overviewQuery.reload}
          />
        ) : (
          <div className={`kpi-grid${overviewQuery.isRefreshing ? ' is-refreshing' : ''}`}>
            {!overview
              ? Array.from({ length: 6 }, (_, i) => <KPICard key={i} label="Loading metric" isLoading />)
              : kpis.map(({ id, ...kpi }) => <KPICard key={id} {...kpi} />)}
          </div>
        )}
      </section>

      {/* Activity + outcome split */}
      <div className="dashboard-grid dashboard-grid--main">
        <DashboardSection
          title="Activity over time"
          subtitle={`Events${serviceLabel ? ` (${serviceLabel})` : ''}, notifications and errors per ${loadedRangeInfo.bucket} · ${rangeLower}`}
          state={{ ...timelineQuery, data: timeline }}
          isEmpty={activityEmpty}
          emptyTitle="No activity in this period"
          emptyMessage="Try a longer time range or a different service."
          skeleton={<ChartSkeleton />}
          onRetry={timelineQuery.reload}
        >
          {timeline && (
            <ActivityChart data={timeline.points} bucket={loadedRangeInfo.bucket} rangeDescription={loadedRangeInfo.description} />
          )}
        </DashboardSection>

        <DashboardSection
          title="Event outcomes"
          subtitle={`Error vs non-error events · ${rangeLower}`}
          state={{ ...overviewQuery, data: overview }}
          isEmpty={!!overview && outcomes.length === 0}
          emptyTitle="No events in this period"
          emptyMessage="Outcome shares appear once events are recorded."
          skeleton={<ListSkeleton rows={2} />}
          onRetry={overviewQuery.reload}
        >
          {overview && (
            <BreakdownList
              label="Event outcomes"
              items={outcomes}
              getLabel={(name) => OUTCOME_LABELS[name]}
              getColor={(name) => OUTCOME_COLORS[name]}
            />
          )}
        </DashboardSection>
      </div>

      {/* Stacked trends */}
      <div className="dashboard-grid dashboard-grid--halves">
        <DashboardSection
          title="Event outcomes over time"
          subtitle={`Errors stacked on non-error events · per ${loadedRangeInfo.bucket}`}
          state={{ ...timelineQuery, data: timeline }}
          isEmpty={outcomesEmpty}
          emptyTitle="No events in this period"
          skeleton={<ChartSkeleton />}
          onRetry={timelineQuery.reload}
        >
          {timeline && (
            <StackedBarChart
              data={stacks}
              series={OUTCOME_SERIES}
              bucket={loadedRangeInfo.bucket}
              tableCaption="Event outcomes per period"
              summary={`Event outcomes chart. ${stackSummary(stacks, OUTCOME_SERIES, loadedRangeInfo.bucket, loadedRangeInfo.description, 'events')}`}
            />
          )}
        </DashboardSection>

        <DashboardSection
          title="Notification delivery over time"
          subtitle={`Delivered vs not yet delivered · per ${loadedRangeInfo.bucket}${allServicesNote}`}
          state={{ ...timelineQuery, data: timeline }}
          isEmpty={deliveryEmpty}
          emptyTitle="No notifications in this period"
          skeleton={<ChartSkeleton />}
          onRetry={timelineQuery.reload}
        >
          {timeline && (
            <StackedBarChart
              data={stacks}
              series={DELIVERY_SERIES}
              bucket={loadedRangeInfo.bucket}
              tableCaption="Notification delivery per period"
              summary={`Notification delivery chart. ${stackSummary(stacks, DELIVERY_SERIES, loadedRangeInfo.bucket, loadedRangeInfo.description, 'notifications')}`}
            />
          )}
        </DashboardSection>
      </div>

      {/* Distributions (range only; the API doesn't filter these by service) */}
      <div className="dashboard-grid dashboard-grid--halves">
        <DashboardSection
          title="Events by service"
          subtitle={`Where events originated · ${rangeLower}${allServicesNote}`}
          state={distributionQuery}
          isEmpty={!!distributions && distributions.eventsByService.length === 0}
          emptyTitle="No events recorded"
          skeleton={<ListSkeleton rows={5} />}
          onRetry={distributionQuery.reload}
        >
          {distributions && (
            <BreakdownList
              label="Events by service"
              items={distributions.eventsByService}
              getLabel={(name) => labelFor(EVENT_SERVICES, name, humanizeIdentifier(name))}
              getColor={(name) => colorFor(EVENT_SERVICES, name)}
            />
          )}
        </DashboardSection>

        <DashboardSection
          title="Top event types"
          subtitle={`Most frequent event types (up to 8) · ${rangeLower}${allServicesNote}`}
          state={distributionQuery}
          isEmpty={!!distributions && distributions.eventTypes.length === 0}
          emptyTitle="No events recorded"
          skeleton={<ListSkeleton rows={5} />}
          onRetry={distributionQuery.reload}
        >
          {distributions && (
            <BreakdownList
              label="Top event types"
              items={distributions.eventTypes}
              getLabel={(name) => name}
              getColor={() => '#06b6d4'}
            />
          )}
        </DashboardSection>
      </div>

      <div className="dashboard-grid dashboard-grid--halves">
        <DashboardSection
          title="Delivery status"
          subtitle={`Delivered, pending and failed notifications · ${rangeLower}`}
          state={distributionQuery}
          isEmpty={!!distributions && distributions.notificationsByStatus.length === 0}
          emptyTitle="No notifications sent"
          skeleton={<ListSkeleton rows={3} />}
          onRetry={distributionQuery.reload}
        >
          {distributions && (
            <BreakdownList
              label="Notifications by delivery status"
              items={distributions.notificationsByStatus}
              getLabel={(name) => labelFor(DELIVERY_STATUSES, name, humanizeIdentifier(name))}
              getColor={(name) => colorFor(DELIVERY_STATUSES, name)}
            />
          )}
        </DashboardSection>

        <DashboardSection
          title="Notifications by channel"
          subtitle={`Delivery medium · ${rangeLower}`}
          state={distributionQuery}
          isEmpty={!!distributions && distributions.notificationsByChannel.length === 0}
          emptyTitle="No notifications sent"
          skeleton={<ListSkeleton rows={3} />}
          onRetry={distributionQuery.reload}
        >
          {distributions && (
            <BreakdownList
              label="Notifications by channel"
              items={distributions.notificationsByChannel}
              getLabel={(name) => labelFor(NOTIFICATION_CHANNELS, name, humanizeIdentifier(name))}
              getColor={(name) => colorFor(NOTIFICATION_CHANNELS, name)}
            />
          )}
        </DashboardSection>
      </div>
    </div>
  );
};

export default AnalyticsPage;
