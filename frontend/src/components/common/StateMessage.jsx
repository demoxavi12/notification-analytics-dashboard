import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

// Empty / error placeholder used by data sections. `tone="error"` renders the
// error variant; pass `onRetry` to offer a retry button, `action` for anything else.
// `announce` adds role="alert" (use for a page's primary content, not for every
// card on a dashboard, where several simultaneous alerts would be noisy).
const StateMessage = ({ tone = 'empty', title, message, onRetry, action, icon: Icon, announce = false, className = '' }) => {
  const isError = tone === 'error';
  const DisplayIcon = Icon || (isError ? AlertTriangle : Inbox);
  return (
    <div className={`section-state${isError ? ' section-state--error' : ''} ${className}`.trim()} role={isError && announce ? 'alert' : undefined}>
      <DisplayIcon size={20} aria-hidden="true" />
      <p className="section-state-title">{title}</p>
      {message && <p className="section-state-message">{message}</p>}
      {(onRetry || action) && (
        <div className="section-state-actions">
          {onRetry && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" /> Retry
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
};

export default StateMessage;
