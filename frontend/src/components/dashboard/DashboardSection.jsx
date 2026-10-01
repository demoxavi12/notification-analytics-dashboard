import { useId } from 'react';
import StateMessage from '../common/StateMessage';

// Card wrapper for data-driven sections (Dashboard and Analytics). It owns the four states
// so no section can render as a blank box:
//   loading (no data yet) -> skeleton
//   error   (no data)     -> message + retry
//   empty                 -> explanation
//   success               -> children (dimmed + aria-busy while refreshing)
const DashboardSection = ({
  title,
  subtitle,
  actions,
  state,
  isEmpty = false,
  emptyTitle = 'Nothing to show yet',
  emptyMessage,
  skeleton,
  onRetry,
  className = '',
  children,
}) => {
  const headingId = useId();
  const hasData = state?.data !== null && state?.data !== undefined;
  const isLoading = state?.status === 'loading';

  let body;
  if (!hasData && isLoading) {
    body = skeleton ?? <div className="skeleton skeleton-block" />;
  } else if (!hasData && state?.status === 'error') {
    body = <StateMessage tone="error" title="Couldn’t load this section" message={state.error} onRetry={onRetry} />;
  } else if (hasData && isEmpty) {
    body = <StateMessage title={emptyTitle} message={emptyMessage} />;
  } else {
    body = children;
  }

  return (
    <section
      className={`card dashboard-section ${className}`.trim()}
      aria-labelledby={headingId}
      aria-busy={isLoading || undefined}
    >
      <div className="card-header dashboard-section-header">
        <div className="dashboard-section-heading">
          <h2 id={headingId} className="card-title">
            {title}
          </h2>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="dashboard-section-actions">{actions}</div>}
      </div>
      <div className={isLoading && hasData ? 'dashboard-section-body is-refreshing' : 'dashboard-section-body'}>
        {body}
      </div>
    </section>
  );
};

export default DashboardSection;
