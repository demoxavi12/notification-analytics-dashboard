import React from 'react';

const KPICard = ({ label, value, subtext, icon: Icon, trend, trendLabel, color = 'var(--primary)' }) => {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className="kpi-icon-wrap" style={{ color }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        <div className="kpi-value">{value ?? '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {trend !== undefined && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: trend >= 0 ? 'var(--success)' : 'var(--error)',
              }}
            >
              {trend >= 0 ? `+${trend}%` : `${trend}%`}
            </span>
          )}
          <span className="kpi-subtext">{subtext || trendLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default KPICard;
