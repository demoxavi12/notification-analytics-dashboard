import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { BarChart3, Filter, Calendar, RefreshCw, Layers } from 'lucide-react';
import { analyticsApi } from '../services/api';
import KPICard from '../components/common/KPICard';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const AnalyticsPage = () => {
  const [range, setRange] = useState('7d');
  const [service, setService] = useState('all');
  const [overview, setOverview] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [distributions, setDistributions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [ovRes, tsRes, distRes] = await Promise.all([
        analyticsApi.getOverview({ range, service }),
        analyticsApi.getTimeSeries({ range, service }),
        analyticsApi.getDistributions({ range }),
      ]);

      setOverview(ovRes.data.data.kpis);
      setTimeseries(tsRes.data.data.timeline || []);
      setDistributions(distRes.data.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range, service]);

  return (
    <div>
      {/* Header with Filters */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Intelligence</h1>
          <p className="page-subtitle">
            Aggregation metrics, delivery trends, and event distribution
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <select
              className="select"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} color="var(--text-muted)" />
            <select
              className="select"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="all">All Microservices</option>
              <option value="auth-service">Auth Service</option>
              <option value="notification-service">Notification Service</option>
              <option value="payment-service">Payment Service</option>
              <option value="api-gateway">API Gateway</option>
              <option value="system">System Core</option>
            </select>
          </div>

          <button
            onClick={fetchAnalytics}
            className="btn btn-secondary btn-sm"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Summary */}
      <div className="kpi-grid">
        <KPICard
          label="Filtered Events"
          value={overview?.totalEvents?.toLocaleString()}
          subtext={`In timeframe (${range})`}
          color="#3b82f6"
        />
        <KPICard
          label="API Throughput"
          value={overview?.apiRequests?.toLocaleString()}
          subtext="Captured requests"
          color="#10b981"
        />
        <KPICard
          label="Notifications Dispatched"
          value={overview?.totalNotifications?.toLocaleString()}
          subtext={`${overview?.successfulNotifications || 0} delivered`}
          color="#8b5cf6"
        />
        <KPICard
          label="Success Rate"
          value={overview?.deliveryRate !== undefined ? `${overview.deliveryRate}%` : '100%'}
          subtext={`${overview?.failedNotifications || 0} failures`}
          color="#06b6d4"
        />
        <KPICard
          label="Error Ingestion"
          value={overview?.errorCount?.toLocaleString()}
          subtext="Anomaly count"
          color="#ef4444"
        />
      </div>

      {/* Main Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Events & Errors Timeline */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Events vs. Errors Timeline</div>
              <div className="card-subtitle">Volume pattern across selected range</div>
            </div>
          </div>

          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeseries}>
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
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                <Bar dataKey="events" name="Total Events" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Notifications Timeline */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Notifications Dispatch Trend</div>
              <div className="card-subtitle">Delivered vs. total notifications</div>
            </div>
          </div>

          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
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
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                <Line
                  type="monotone"
                  dataKey="notifications"
                  name="Total Alerts"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="deliveredNotifications"
                  name="Delivered"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distributions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Top Event Types */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Event Types</div>
              <div className="card-subtitle">Distribution by event identifier</div>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributions?.eventTypes || []}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={11} width={110} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" name="Count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Notifications Channel Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Alerts by Channel</div>
              <div className="card-subtitle">Delivery medium distribution</div>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributions?.notificationsByChannel || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                >
                  {(distributions?.notificationsByChannel || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* Notifications Delivery Status */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Delivery Status</div>
              <div className="card-subtitle">Delivered vs failed vs pending</div>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributions?.notificationsByStatus || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                >
                  {(distributions?.notificationsByStatus || []).map((entry) => {
                    let fill = '#10b981';
                    if (entry.name === 'failed') fill = '#ef4444';
                    if (entry.name === 'pending') fill = '#f59e0b';
                    return <Cell key={entry.name} fill={fill} />;
                  })}
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
    </div>
  );
};

export default AnalyticsPage;
