import Badge from '../common/Badge';
import { DetailList, JsonBlock } from '../common/DetailList';
import { formatDateTime, formatRelativeTime, humanizeIdentifier } from '../../utils/formatters';
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, labelFor } from '../../utils/domainLabels';

const TimeValue = ({ value }) =>
  value ? (
    <time dateTime={new Date(value).toISOString()}>
      {formatDateTime(value)} <span className="detail-muted">({formatRelativeTime(value)})</span>
    </time>
  ) : null;

// Body of the notification details dialog (from the list payload; no extra request).
// The message is rendered as plain text.
const NotificationDetails = ({ notification: n, showRecipient }) => (
  <div className="detail-view">
    <p className="detail-message">{n.message || <span className="detail-muted">No message body.</span>}</p>
    <DetailList
      items={[
        { label: 'Read state', value: n.read ? 'Read' : <strong>Unread</strong> },
        { label: 'Type', value: <Badge type={n.type}>{labelFor(NOTIFICATION_TYPES, n.type, humanizeIdentifier(n.type))}</Badge> },
        {
          label: 'Delivery',
          value: <Badge type={n.status}>{labelFor(DELIVERY_STATUSES, n.status, humanizeIdentifier(n.status))}</Badge>,
        },
        { label: 'Channel', value: labelFor(NOTIFICATION_CHANNELS, n.channel, humanizeIdentifier(n.channel)) },
        showRecipient && {
          label: 'Recipient',
          value: n.recipient ? [n.recipient.name, n.recipient.email].filter(Boolean).join(' · ') || n.recipient.id : 'Unknown',
          wide: true,
        },
        { label: 'Sent', value: <TimeValue value={n.createdAt} />, wide: true },
        n.updatedAt && n.updatedAt !== n.createdAt && { label: 'Last updated', value: <TimeValue value={n.updatedAt} />, wide: true },
        { label: 'Notification ID', value: <code className="detail-id">{n.id}</code>, wide: true },
      ]}
    />
    <JsonBlock value={n.metadata} label="Metadata" />
  </div>
);

export default NotificationDetails;
