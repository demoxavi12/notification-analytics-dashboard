import { memo, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCount } from '../../utils/formatters';
import { formatBucket } from '../../utils/chartFormat';

// Colors match the existing PulseOps palette (primary blue, notification violet, error red).
const ACTIVITY_SERIES = [
  { key: 'events', label: 'Events', color: '#3b82f6' },
  { key: 'notifications', label: 'Notifications', color: '#8b5cf6' },
  { key: 'errors', label: 'Errors', color: '#ef4444' },
];

const ChartTooltip = ({ active, payload, label, bucket }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatBucket(label, bucket, true)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-swatch" style={{ backgroundColor: entry.color }} aria-hidden="true" />
          <span>{entry.name}</span>
          <strong>{formatCount(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const ActivityChart = ({ data, bucket, rangeDescription }) => {
  // Screen-reader summary: totals and the busiest bucket.
  const summary = useMemo(() => {
    const totals = { events: 0, notifications: 0, errors: 0 };
    let busiest = null;
    for (const point of data) {
      totals.events += point.events;
      totals.notifications += point.notifications;
      totals.errors += point.errors;
      if (!busiest || point.events > busiest.events) busiest = point;
    }
    const peak =
      busiest && busiest.events > 0
        ? ` Busiest period: ${formatBucket(busiest.time, bucket, true)} with ${formatCount(busiest.events)} events.`
        : '';
    return `${rangeDescription}: ${formatCount(totals.events)} events, ${formatCount(totals.notifications)} notifications and ${formatCount(totals.errors)} errors.${peak}`;
  }, [data, bucket, rangeDescription]);

  return (
    <figure className="activity-chart">
      <div className="activity-chart-canvas" role="img" aria-label={`Activity chart. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="activityEventsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="activityNotificationsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(time) => formatBucket(time, bucket)}
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip bucket={bucket} />} cursor={{ stroke: 'var(--border-light)' }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              itemSorter={null} // keep series order (Events, Notifications, Errors), not alphabetical
              wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="events"
              name="Events"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#activityEventsFill)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="notifications"
              name="Notifications"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#activityNotificationsFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="errors"
              name="Errors"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sr-only">{summary}</figcaption>

      {/* Exact values for anyone who prefers (or needs) a table over a chart */}
      <details className="chart-data-details">
        <summary>View data table</summary>
        <div className="table-container chart-data-table">
          <table className="data-table">
            <caption className="sr-only">Activity per {bucket === 'hour' ? 'hour' : 'day'}</caption>
            <thead>
              <tr>
                <th scope="col">{bucket === 'hour' ? 'Hour' : 'Day (UTC)'}</th>
                {ACTIVITY_SERIES.map((series) => (
                  <th key={series.key} scope="col">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{formatBucket(point.time, bucket, true)}</th>
                  {ACTIVITY_SERIES.map((series) => (
                    <td key={series.key}>{formatCount(point[series.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};

export default memo(ActivityChart);
