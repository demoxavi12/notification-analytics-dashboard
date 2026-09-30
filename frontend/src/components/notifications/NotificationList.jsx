import { memo } from 'react';
import { Check, Mail, MonitorSmartphone, Smartphone, Trash2 } from 'lucide-react';
import Badge from '../common/Badge';
import RelativeTime from '../common/RelativeTime';
import { humanizeIdentifier } from '../../utils/formatters';
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, labelFor } from '../../utils/domainLabels';

const CHANNEL_ICONS = { email: Mail, push: Smartphone, 'in-app': MonitorSmartphone };

const recipientLabel = (recipient) => recipient?.name || recipient?.email || 'Unknown recipient';

// One card per notification. Unread state is conveyed by text ("Unread") and the
// accent bar, never by color alone. Every action button names its notification.
const NotificationList = ({ notifications, now, label, showRecipient, pendingIds, onOpen, onMarkRead, onDelete }) => (
  <ul className="record-list" aria-label={label}>
    {notifications.map((n) => {
      const ChannelIcon = CHANNEL_ICONS[n.channel] || MonitorSmartphone;
      const isPending = pendingIds.has(n.id);
      return (
        <li key={n.id}>
          <article className={`record-card notification-card${n.read ? '' : ' notification-card--unread'}`} aria-busy={isPending || undefined}>
            <div className="notification-card-main">
              <div className="notification-card-heading">
                {!n.read && <span className="activity-unread-label">Unread</span>}
                <h3 className="notification-card-title">
                  <button type="button" className="link-button" onClick={() => onOpen(n)}>
                    {n.title}
                  </button>
                </h3>
              </div>
              {n.message && <p className="notification-card-message">{n.message}</p>}
              <div className="record-card-meta">
                <Badge type={n.type}>{labelFor(NOTIFICATION_TYPES, n.type, humanizeIdentifier(n.type))}</Badge>
                <Badge type={n.status}>{labelFor(DELIVERY_STATUSES, n.status, humanizeIdentifier(n.status))}</Badge>
                <span className="activity-channel">
                  <ChannelIcon size={12} aria-hidden="true" />
                  {labelFor(NOTIFICATION_CHANNELS, n.channel, humanizeIdentifier(n.channel))}
                </span>
                {showRecipient && <span>To {recipientLabel(n.recipient)}</span>}
                <RelativeTime value={n.createdAt} now={now} />
              </div>
            </div>

            <div className="notification-card-actions">
              {!n.read && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onMarkRead(n)}
                  disabled={isPending}
                  aria-label={`Mark “${n.title}” as read`}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => onDelete(n)}
                disabled={isPending}
                aria-label={`Delete “${n.title}”`}
                title="Delete notification"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </article>
        </li>
      );
    })}
  </ul>
);

export default memo(NotificationList);
