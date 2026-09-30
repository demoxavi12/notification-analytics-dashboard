import { memo, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { describeSystemHealth, HEALTH_LEVELS } from '../../utils/serviceHealth';

const LEVEL_ICON = { ok: CheckCircle2, checking: LoaderCircle, degraded: AlertTriangle, down: XCircle };

const HealthIcon = ({ level, size = 16 }) => {
  const Icon = LEVEL_ICON[level];
  return <Icon size={size} className={`health-icon health-icon--${level}`} aria-hidden="true" />;
};

// Uses the health state DashboardLayout already polls (no extra requests).
const ServiceHealthPanel = ({ systemHealth }) => {
  const { level, summary, services } = useMemo(() => describeSystemHealth(systemHealth), [systemHealth]);

  return (
    <div className="health-panel">
      <p className={`health-summary health-summary--${level}`} role="status">
        <HealthIcon level={level} size={18} />
        <span>{summary}</span>
      </p>
      <ul className="health-list">
        {services.map((service) => (
          <li key={service.id} className="health-item">
            <HealthIcon level={service.level} />
            <div className="health-item-text">
              <span className="health-item-name">{service.name}</span>
              {service.detail && <span className="health-item-detail">{service.detail}</span>}
            </div>
            <span className={`health-item-level health-item-level--${service.level}`}>
              {HEALTH_LEVELS[service.level].label}
            </span>
          </li>
        ))}
      </ul>
      <p className="health-footnote">Refreshed automatically every 20 seconds.</p>
    </div>
  );
};

export default memo(ServiceHealthPanel);
