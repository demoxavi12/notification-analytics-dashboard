import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import useDashboardData from '../features/dashboard/useDashboardData';
import { DASHBOARD_RANGES } from '../features/dashboard/dashboardModel';
import KPICard from '../components/common/KPICard';
import DashboardSection from '../components/dashboard/DashboardSection';
import ActivityChart from '../components/dashboard/ActivityChart';
import BreakdownList from '../components/dashboard/BreakdownList';
import ServiceHealthPanel from '../components/dashboard/ServiceHealthPanel';
import RangeSelector from '../components/dashboard/RangeSelector';
import { RecentEventsList, RecentNotificationsList } from '../components/dashboard/RecentActivity';
import { formatCount, formatPercent, formatRelativeTime, formatDateTime, humanizeIdentifier } from '../utils/formatters';
import {
  DELIVERY_STATUSES,
  EVENT_SERVICES,
  NOTIFICATION_CHANNELS,
  colorFor,
  labelFor,
} from '../utils/domainLabels';


const SIMULATIONS = [
  { type: 'payment', label: 'Payment event' },
  { type: 'notification', label: 'Notification alert' },
  { type: 'auth', label: 'API request' },
  { type: 'system', label: 'System error', danger: true },
];

// Skeletons sized like the content they replace, to avoid layout shift.
const ChartSkeleton = () => <div className="skeleton skeleton-chart" />;
const ListSkeleton = ({ rows = 4 }) => (
  <div className="skeleton-list">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </div>
);

const DashboardPage = () => {
  const { isAdmin } = useAuth();
  const { refreshUnreadCount, systemHealth } = useOutletContext() || {};
  const dashboard = useDashboardData({ isAdmin, onUnreadCountChange: refreshUnreadCount });
  const { sections, range, loadedRange } = dashboard;

  const rangeInfo = DASHBOARD_RANGES[loadedRange];
  const overview = sections.overview.data;
  const overviewLoading = !overview && sections.overview.status === 'loading';

  // KPI definitions derived from the normalized overview; recomputed only when it changes.
  const kpis = useMemo(() => {
    if (!overview) return [];
    const periodLabel = rangeInfo.description.toLowerCase();
    const list = [
      {
        id: 'events',
        label: 'Total events',
        value: formatCount(overview.totalEvents),
        subtext: overview.totalEvents > 0 ? `Ingested in the ${periodLabel}` : `No events in the ${periodLabel}`,
        icon: Activity,
        color: '#3b82f6',
      },
      {
        id: 'errors',
        label: 'Failed events',
        value: formatCount(overview.errorCount),
        subtext:
          overview.errorRate === null ? 'No events to evaluate' : `${formatPercent(overview.errorRate)} of all events`,
        subtextTone: overview.errorCount > 0 ? 'error' : undefined,
        icon: AlertTriangle,
        color: '#ef4444',
      },
      {
        id: 'notifications',
        label: 'Notifications sent',
        value: formatCount(overview.totalNotifications),
        subtext:
          overview.totalNotifications > 0
            ? `${formatCount(overview.delivered)} delivered · ${formatCount(overview.pending)} pending`
            : `None sent in the ${periodLabel}`,
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
        color: '#06b6d4',
      },
      {
        id: 'api',
        label: 'API requests',
        value: formatCount(overview.apiRequests),
        subtext: 'Recorded by the API gateway',
        icon: Globe,
        color: '#10b981',
      },
    ];
    if (overview.totalUsers !== null) {
      list.push({
        id: 'users',
        label: 'Registered users',
        value: formatCount(overview.totalUsers),
        subtext: 'All accounts (admin view)',
        icon: Users,
        color: '#f59e0b',
      });
    }
    return list;
  }, [overview, rangeInfo]);

  const timeline = sections.timeline.data;
  const timelineIsEmpty = useMemo(
    () => !!timeline && timeline.every((p) => p.events === 0 && p.notifications === 0 && p.errors === 0),
    [timeline]
  );

  const distributions = sections.distributions.data;
  const scopeNote = isAdmin ? 'Across all users' : 'Your events and notifications';

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Operational overview of events, notification delivery and service health</p>
        </div>

        <div className="dashboard-controls">
          <RangeSelector value={range} options={DASHBOARD_RANGES} onChange={dashboard.setRange} />
          <button
            type="button"
            onClick={dashboard.refresh}
            className="btn btn-secondary btn-sm"
            disabled={dashboard.isRefreshing}
            aria-label={dashboard.isRefreshing ? 'Refreshing dashboard' : 'Refresh dashboard'}
          >
            <RefreshCw size={14} className={dashboard.isRefreshing ? 'spin' : undefined} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <p className="dashboard-updated" aria-live="polite">
        {dashboard.isRefreshing
          ? 'Updating…'
          : dashboard.lastUpdated
            ? (
              <>
                Updated <time dateTime={new Date(dashboard.lastUpdated).toISOString()} title={formatDateTime(dashboard.lastUpdated)}>{formatRelativeTime(dashboard.lastUpdated)}</time>
                {' · '}
                {rangeInfo.description} · {scopeNote}
              </>
            )
            : null}
      </p>

      {/* Data-source notices */}
      {dashboard.mode === 'demo' && (
        <div className="dashboard-notice dashboard-notice--info" role="status">
          <Database size={16} aria-hidden="true" />
          <span>
            <strong>Demo data.</strong> The backend is unavailable, so this dashboard is showing generated data based
            on the project’s seed dataset (development only). Actions are not saved.
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={dashboard.disableDemoMode}>
            Try live data
          </button>
        </div>
      )}
      {dashboard.canUseDemoMode && (
        <div className="dashboard-notice dashboard-notice--warning" role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>
            <strong>Backend unreachable.</strong> Live metrics can’t be loaded. Start the API and retry, or preview
            the dashboard with demo data.
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={dashboard.enableDemoMode}>
            Use demo data
          </button>
        </div>
      )}
      {dashboard.actionError && (
        <div className="dashboard-notice dashboard-notice--error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{dashboard.actionError}</span>
        </div>
      )}

      {/* KPI summary */}
      <section aria-labelledby="dashboard-kpi-heading" className="dashboard-kpis">
        <h2 id="dashboard-kpi-heading" className="sr-only">
          Key metrics
        </h2>
        {sections.overview.status === 'error' && !overview ? (
          <div className="card section-state section-state--error">
            <AlertTriangle size={20} aria-hidden="true" />
            <p className="section-state-title">Couldn’t load summary metrics</p>
            <p className="section-state-message">{sections.overview.error}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={dashboard.refresh}>
              <RefreshCw size={14} aria-hidden="true" /> Retry
            </button>
          </div>
        ) : (
          <div className={`kpi-grid${sections.overview.status === 'loading' && overview ? ' is-refreshing' : ''}`}>
            {overviewLoading
              ? Array.from({ length: isAdmin ? 6 : 5 }, (_, i) => <KPICard key={i} label="Loading metric" isLoading />)
              : kpis.map(({ id, ...kpi }) => <KPICard key={id} {...kpi} />)}
          </div>
        )}
      </section>

      {/* Activity + health */}
      <div className="dashboard-grid dashboard-grid--main">
        <DashboardSection
          title="Activity over time"
          subtitle={`Events, notifications and errors per ${rangeInfo.bucket} · ${rangeInfo.description.toLowerCase()}`}
          state={sections.timeline}
          isEmpty={timelineIsEmpty}
          emptyTitle="No activity in this period"
          emptyMessage="Events and notifications will appear here as services report them. Try a longer time range."
          skeleton={<ChartSkeleton />}
          onRetry={dashboard.refresh}
          actions={
            <Link to="/analytics" className="btn btn-outline btn-sm">
              Deep dive
            </Link>
          }
        >
          {timeline && (
            <ActivityChart data={timeline} bucket={rangeInfo.bucket} rangeDescription={rangeInfo.description} />
          )}
        </DashboardSection>

        <DashboardSection
          title="Service health"
          subtitle="Live infrastructure status"
          state={{ status: 'success', data: systemHealth || {} }}
        >
          <ServiceHealthPanel systemHealth={systemHealth} />
        </DashboardSection>
      </div>

      {/* Breakdowns */}
      <div className="dashboard-grid dashboard-grid--halves">
        <DashboardSection
          title="Events by service"
          subtitle={`Where events originated · ${rangeInfo.description.toLowerCase()}`}
          state={sections.distributions}
          isEmpty={!!distributions && distributions.eventsByService.length === 0}
          emptyTitle="No events recorded"
          emptyMessage="There were no events from any service in this period."
          skeleton={<ListSkeleton rows={5} />}
          onRetry={dashboard.refresh}
        >
          {distributions && (
            <>
              <BreakdownList
                label="Events by service"
                items={distributions.eventsByService}
                getLabel={(name) => labelFor(EVENT_SERVICES, name, humanizeIdentifier(name))}
                getColor={(name) => colorFor(EVENT_SERVICES, name)}
              />
              {distributions.eventTypes.length > 0 && (
                <div className="breakdown-footer">
                  <h3 className="breakdown-subheading">Most frequent event types</h3>
                  <ul className="tag-list" aria-label="Most frequent event types">
                    {distributions.eventTypes.slice(0, 5).map((type) => (
                      <li key={type.name} className="tag">
                        <code>{type.name}</code> <span className="tag-count">{formatCount(type.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DashboardSection>

        <DashboardSection
          title="Notification delivery"
          subtitle={`Delivery outcome and channel · ${rangeInfo.description.toLowerCase()}`}
          state={sections.distributions}
          isEmpty={!!distributions && distributions.notificationsByStatus.length === 0}
          emptyTitle="No notifications sent"
          emptyMessage="Delivery results will appear here once notifications are dispatched."
          skeleton={<ListSkeleton rows={4} />}
          onRetry={dashboard.refresh}
        >
          {distributions && (
            <>
              <BreakdownList
                label="Notifications by delivery status"
                items={distributions.notificationsByStatus}
                getLabel={(name) => labelFor(DELIVERY_STATUSES, name, humanizeIdentifier(name))}
                getColor={(name) => colorFor(DELIVERY_STATUSES, name)}
              />
              {distributions.notificationsByChannel.length > 0 && (
                <div className="breakdown-footer">
                  <h3 className="breakdown-subheading">By channel</h3>
                  <BreakdownList
                    label="Notifications by channel"
                    items={distributions.notificationsByChannel}
                    getLabel={(name) => labelFor(NOTIFICATION_CHANNELS, name, humanizeIdentifier(name))}
                    getColor={(name) => colorFor(NOTIFICATION_CHANNELS, name)}
                  />
                </div>
              )}
            </>
          )}
        </DashboardSection>
      </div>

      {/* Recent activity */}
      <div className="dashboard-grid dashboard-grid--halves">
        <DashboardSection
          title="Recent events"
          subtitle="Latest events ingested across services"
          state={sections.recentEvents}
          isEmpty={!!sections.recentEvents.data && sections.recentEvents.data.length === 0}
          emptyTitle="No events yet"
          emptyMessage="Events will appear here as services report them."
          skeleton={<ListSkeleton rows={6} />}
          onRetry={dashboard.refresh}
          actions={
            <Link to="/events" className="btn btn-outline btn-sm">
              View all
            </Link>
          }
        >
          {sections.recentEvents.data && <RecentEventsList events={sections.recentEvents.data} />}
        </DashboardSection>

        <DashboardSection
          title="Recent notifications"
          subtitle="Your latest alerts and their delivery status"
          state={sections.recentNotifications}
          isEmpty={!!sections.recentNotifications.data && sections.recentNotifications.data.length === 0}
          emptyTitle="You’re all caught up"
          emptyMessage="New notifications addressed to you will appear here."
          skeleton={<ListSkeleton rows={5} />}
          onRetry={dashboard.refresh}
          actions={
            <Link to="/notifications" className="btn btn-outline btn-sm">
              View all
            </Link>
          }
        >
          {sections.recentNotifications.data && (
            <RecentNotificationsList
              notifications={sections.recentNotifications.data}
              onMarkRead={dashboard.markNotificationRead}
            />
          )}
        </DashboardSection>
      </div>

      {/* Event simulator (existing feature; uses POST /events/simulate) */}
      <section className="card dashboard-simulator" aria-labelledby="dashboard-simulator-heading">
        <div className="dashboard-simulator-intro">
          <div className="dashboard-simulator-icon" aria-hidden="true">
            <Zap size={20} />
          </div>
          <div>
            <h2 id="dashboard-simulator-heading" className="card-title">
              Event simulator
            </h2>
            <p className="card-subtitle">
              Emit a test event from a service to see ingestion, caching and aggregation update live.
            </p>
          </div>
        </div>
        <div className="dashboard-simulator-actions">
          {SIMULATIONS.map((sim) => (
            <button
              key={sim.type}
              type="button"
              onClick={() => dashboard.simulateEvent(sim.type, sim.label)}
              className="btn btn-secondary btn-sm"
              style={sim.danger ? { color: 'var(--error)' } : undefined}
              disabled={dashboard.simulation.status === 'pending' || dashboard.mode === 'demo'}
            >
              + {sim.label}
            </button>
          ))}
        </div>
        <p
          className={`dashboard-simulator-status dashboard-simulator-status--${dashboard.simulation.status}`}
          role="status"
        >
          {dashboard.mode === 'demo'
            ? 'The simulator needs the live backend and is disabled in demo mode.'
            : dashboard.simulation.message}
        </p>
      </section>
    </div>
  );
};

export default DashboardPage;
