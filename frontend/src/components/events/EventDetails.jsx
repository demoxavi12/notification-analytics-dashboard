import Badge from '../common/Badge';
import { DetailList, JsonBlock } from '../common/DetailList';
import { formatDateTime, formatLatency, formatRelativeTime, humanizeIdentifier } from '../../utils/formatters';
import { EVENT_SERVICES, EVENT_STATUSES, labelFor } from '../../utils/domainLabels';

// Body of the event inspection dialog. Uses the list payload (no extra request).
const EventDetails = ({ event }) => (
  <div className="detail-view">
    <DetailList
      items={[
        { label: 'Event type', value: <code>{event.type}</code>, wide: true },
        {
          label: 'Status',
          value: <Badge type={event.status}>{labelFor(EVENT_STATUSES, event.status, humanizeIdentifier(event.status))}</Badge>,
        },
        { label: 'Service', value: labelFor(EVENT_SERVICES, event.service, humanizeIdentifier(event.service)) },
        { label: 'Source', value: event.source || '—' },
        {
          label: 'User',
          value: event.user ? [event.user.name, event.user.email].filter(Boolean).join(' · ') || event.user.id : 'System (no user)',
        },
        {
          label: 'Timestamp',
          value: event.timestamp ? (
            <time dateTime={new Date(event.timestamp).toISOString()}>
              {formatDateTime(event.timestamp)} <span className="detail-muted">({formatRelativeTime(event.timestamp)})</span>
            </time>
          ) : (
            'Unknown'
          ),
          wide: true,
        },
        { label: 'Latency', value: formatLatency(event.latencyMs) },
        { label: 'Event ID', value: <code className="detail-id">{event.id}</code>, wide: true },
      ]}
    />
    <JsonBlock value={event.metadata} label="Metadata" />
  </div>
);

export default EventDetails;
