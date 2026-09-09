import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Activity,
  Bell,
  Users,
  AlertTriangle,
  Send,
  Zap,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { analyticsApi, eventsApi, notificationsApi } from '../services/api';
import KPICard from '../components/common/KPICard';
import Badge from '../components/common/Badge';

const SERVICE_COLORS = {
  'auth-service': '#3b82f6',
  'notification-service': '#10b981',
  'payment-service': '#8b5cf6',
  'api-gateway': '#06b6d4',
  system: '#ef4444',
};

const DashboardPage = () => {
  const [overview, setOverview] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [distributions, setDistributions] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { refreshUnreadCount } = useOutletContext() || {};

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ovRes, tsRes, distRes, evRes, notifRes] = await Promise.all([
        analyticsApi.getOverview({ range: '7d' }),
        analyticsApi.getTimeSeries({ range: '7d' }),
        analyticsApi.getDistributions({ range: '7d' }),
        eventsApi.getEvents({ limit: 6 }),
        notificationsApi.getNotifications({ limit: 5 }),
      ]);

      setOverview(ovRes.data.data.kpis);
      setTimeseries(tsRes.data.data.timeline || []);
      setDistributions(distRes.data.data);
      setRecentEvents(evRes.data.data || []);
      setRecentNotifications(notifRes.data.data || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.error?.message || 'Could not load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSimulate = async (serviceType) => {
    setIsSimulating(true);
    try {
      await eventsApi.simulateEvent(serviceType);
      // Refresh metrics and feeds
      await fetchDashboardData();
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      alert('Event simulation failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsSimulating(false);
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  if (isLoading && !overview) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Loading SaaS analytics...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">
            Cross-service monitoring, event streaming, and delivery metrics
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchDashboardData}
            className="btn btn-secondary btn-sm"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Simulator Action Banner */}
      <div
        className="card"
        style={{
          marginBottom: '24px',
          background: 'linear-gradient(90deg, rgba(31,41,55,0.8) 0%, rgba(17,24,39,0.9) 100%)',
          borderColor: 'var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                Live Service Ingestion Simulator
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Emit real-time events across microservices to observe live cache invalidation and aggregation.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSimulate('payment')}
              className="btn btn-secondary btn-sm"
              disabled={isSimulating}
            >
              + Payment Event
            </button>
            <button
              onClick={() => handleSimulate('notification')}
              className="btn btn-secondary btn-sm"
              disabled={isSimulating}
            >
              + Notification Alert
            </button>
            <button
              onClick={() => handleSimulate('auth')}
              className="btn btn-secondary btn-sm"
              disabled={isSimulating}
            >
              + API Request
            </button>
            <button
              onClick={() => handleSimulate('system')}
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--error)' }}
              disabled={isSimulating}
            >
              + System Error
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '14px',
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={fetchDashboardData} className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        <KPICard
          label="Total Events"
          value={overview?.totalEvents?.toLocaleString()}
          subtext="Past 7 days"
          icon={Activity}
          trend={14.2}
          color="#3b82f6"
        />
        <KPICard
          label="Active Users"
          value={overview?.totalUsers?.toLocaleString()}
          subtext="Registered accounts"
          icon={Users}
          color="#10b981"
        />
        <KPICard
          label="Notifications Sent"
          value={overview?.totalNotifications?.toLocaleString()}
          subtext={`${overview?.successfulNotifications || 0} delivered`}
          icon={Bell}
          trend={8.5}
          color="#8b5cf6"
        />
        <KPICard
          label="Delivery Success"
          value={overview?.deliveryRate !== undefined ? `${overview.deliveryRate}%` : '100%'}
          subtext={`${overview?.failedNotifications || 0} failed alerts`}
          icon={CheckCircle2}
          color="#06b6d4"
        />
        <KPICard
          label="System Errors"
          value={overview?.errorCount?.toLocaleString()}
          subtext="Requires inspection"
          icon={AlertTriangle}
          color="#ef4444"
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Timeline Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Activity Volume Over Time</div>
              <div className="card-subtitle">Aggregated events & errors over the last 7 days</div>
            </div>
            <button onClick={() => navigate('/analytics')} className="btn btn-outline btn-sm">
              Deep Dive
            </button>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f9fafb',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  name="Events"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEvents)"
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  name="Errors"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorErrors)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Breakdown Donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Events by Service</div>
              <div className="card-subtitle">Cluster source breakdown</div>
            </div>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributions?.eventsByService || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {(distributions?.eventsByService || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SERVICE_COLORS[entry.name] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two-Column Feeds: Recent Events & Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {/* Recent Events */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Ingested Events</div>
              <div className="card-subtitle">Real-time pipeline stream</div>
            </div>
            <button onClick={() => navigate('/events')} className="btn btn-outline btn-sm">
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentEvents.length === 0 ? (
              <div className="empty-state">No recent events found</div>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge type={event.status}>{event.status}</Badge>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.eventType}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Service: {event.service} • {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Notifications</div>
              <div className="card-subtitle">Inbox & alert dispatching</div>
            </div>
            <button onClick={() => navigate('/notifications')} className="btn btn-outline btn-sm">
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentNotifications.length === 0 ? (
              <div className="empty-state">No notifications right now</div>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: notif.read ? 'var(--bg-tertiary)' : 'rgba(59, 130, 246, 0.08)',
                    borderLeft: notif.read ? 'none' : '3px solid var(--primary)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Badge type={notif.type}>{notif.type}</Badge>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: notif.read ? 500 : 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        via {notif.channel} • {new Date(notif.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {!notif.read && (
                    <button
                      onClick={() => handleMarkNotificationRead(notif._id)}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
