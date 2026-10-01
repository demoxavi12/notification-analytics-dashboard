import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount } from '../../utils/formatters';
import { formatBucket } from '../../utils/chartFormat';

// Stacked bars over time buckets (output of normalizeTimeline / deriveTimelineStacks).
// `series`: [{ key, label, color }] in stack order. `summary` is the text alternative
// for screen readers; the optional data table exposes exact values to everyone.

const StackTooltip = ({ active, payload, label, bucket }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
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
      <div className="chart-tooltip-row chart-tooltip-total">
        <span aria-hidden="true" />
        <span>Total</span>
        <strong>{formatCount(total)}</strong>
      </div>
    </div>
  );
};

const StackedBarChart = ({ data, series, bucket, summary, tableCaption }) => (
  <figure className="activity-chart">
    <div className="activity-chart-canvas" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(time) => formatBucket(time, bucket)}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip content={<StackTooltip bucket={bucket} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            itemSorter={null}
            wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
          />
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color}
              radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <figcaption className="sr-only">{summary}</figcaption>

    <details className="chart-data-details">
      <summary>View data table</summary>
      <div className="table-container chart-data-table">
        <table className="data-table">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{bucket === 'hour' ? 'Hour' : 'Day (UTC)'}</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key}>
                <th scope="row">{formatBucket(row.time, bucket, true)}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatCount(row[s.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  </figure>
);

export default memo(StackedBarChart);
