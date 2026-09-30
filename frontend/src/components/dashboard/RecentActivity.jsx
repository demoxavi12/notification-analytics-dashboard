import { memo } from 'react';
import { Mail, MonitorSmartphone, Smartphone } from 'lucide-react';
import Badge from '../common/Badge';
import RelativeTime from '../common/RelativeTime';
import useNow from '../../hooks/useNow';
import { formatLatency, humanizeIdentifier } from '../../utils/formatters';
import {
  DELIVERY_STATUSES,
  EVENT_SERVICES,
  EVENT_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  labelFor,
} from '../../utils/domainLabels';

export const RecentEventsList = memo(({ events }) => {
  const now = useNow();
  return (
    <ul className="activity-list" aria-label="Recent events">
      {events.map((event) => {
        const latency = formatLatency(event.latencyMs);
        return (
          <li key={event.id} className="activity-item">
            <Badge type={event.status}>{labelFor(EVENT_STATUSES, event.status, humanizeIdentifier(event.status))}</Badge>
            <div className="activity-body">
              <div className="activity-title">
                {humanizeIdentifier(event.type)}
                <code className="activity-code">{event.type}</code>
              </div>
              <div className="activity-meta">
                <span>{labelFor(EVENT_SERVICES, event.service, humanizeIdentifier(event.service))}</span>
                {event.source && <span>via {event.source}</span>}
                {latency && <span>{latency}</span>}
                <RelativeTime value={event.timestamp} now={now} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
});
RecentEventsList.displayName = 'RecentEventsList';

const CHANNEL_ICON = { email: Mail, push: Smartphone, 'in-app': MonitorSmartphone };

export const RecentNotificationsList = memo(({ notifications, onMarkRead }) => {
  const now = useNow();
  return (
    <ul className="activity-list" aria-label="Recent notifications">
      {notifications.map((notification) => {
        const ChannelIcon = CHANNEL_ICON[notification.channel] || MonitorSmartphone;
        return (
          <li key={notification.id} className={`activity-item${notification.read ? '' : ' activity-item--unread'}`}>
            <Badge type={notification.status}>
              {labelFor(DELIVERY_STATUSES, notification.status, humanizeIdentifier(notification.status))}
            </Badge>
            <div className="activity-body">
              <div className="activity-title" title={notification.title}>
                {notification.title}
              </div>
              <div className="activity-meta">
                {!notification.read && <span className="activity-unread-label">Unread</span>}
                <span className="activity-channel">
                  <ChannelIcon size={12} aria-hidden="true" />
                  {labelFor(NOTIFICATION_CHANNELS, notification.channel, humanizeIdentifier(notification.channel))}
                </span>
                <span>{labelFor(NOTIFICATION_TYPES, notification.type, humanizeIdentifier(notification.type))}</span>
                <RelativeTime value={notification.createdAt} now={now} />
              </div>
            </div>
            {!notification.read && onMarkRead && (
              <button
                type="button"
                className="btn btn-outline btn-sm activity-action"
                onClick={() => onMarkRead(notification.id)}
                aria-label={`Mark “${notification.title}” as read`}
              >
                Mark read
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
});
RecentNotificationsList.displayName = 'RecentNotificationsList';
