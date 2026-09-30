// Summary metric tile. Backward compatible with existing usages
// (label/value/subtext/icon/trend/trendLabel/color); additions:
//   isLoading    - shows a skeleton instead of the value
//   subtextTone  - 'success' | 'warning' | 'error' to emphasise context (text stays meaningful)
const TONE_COLOR = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
};

const KPICard = ({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  trendLabel,
  color = 'var(--primary)',
  isLoading = false,
  subtextTone,
}) => {
  return (
    <div className="kpi-card" aria-busy={isLoading || undefined}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className="kpi-icon-wrap" style={{ color }} aria-hidden="true">
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        {isLoading ? (
          <>
            <div className="skeleton skeleton-kpi-value" />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            <span className="sr-only">Loading {label}</span>
          </>
        ) : (
          <>
            <div className="kpi-value">{value ?? '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {trend !== undefined && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: trend >= 0 ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {/* Sign is part of the text, so the trend is not conveyed by color alone */}
                  {trend >= 0 ? `+${trend}%` : `${trend}%`}
                </span>
              )}
              {(subtext || trendLabel) && (
                <span className="kpi-subtext" style={subtextTone ? { color: TONE_COLOR[subtextTone] } : undefined}>
                  {subtext || trendLabel}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default KPICard;
