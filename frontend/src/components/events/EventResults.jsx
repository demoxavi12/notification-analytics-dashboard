import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import Badge from '../common/Badge';
import RelativeTime from '../common/RelativeTime';
import { formatDateTime, formatLatency, humanizeIdentifier } from '../../utils/formatters';
import { EVENT_SERVICES, EVENT_STATUSES, labelFor } from '../../utils/domainLabels';

const statusLabel = (status) => labelFor(EVENT_STATUSES, status, humanizeIdentifier(status));
const serviceLabel = (service) => labelFor(EVENT_SERVICES, service, humanizeIdentifier(service));
const userLabel = (user) => (user ? user.name || user.email || 'Unknown user' : 'System');

const detailsLabel = (event) => `View details for ${event.type} event from ${formatDateTime(event.timestamp)}`;

// Desktop/tablet: a real table (column headers, caption) with lower-priority columns
// hidden by container queries as the content area narrows.
export const EventsTable = memo(({ events, now, onSelect, caption }) => (
  <div className="table-container results-table">
    <table className="data-table events-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Status</th>
          <th scope="col">Event</th>
          <th scope="col">Service</th>
          <th scope="col" className="col-optional">
            User
          </th>
          <th scope="col">Time</th>
          <th scope="col" className="col-actions">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          const latency = formatLatency(event.latencyMs);
          return (
            <tr key={event.id}>
              <td>
                <Badge type={event.status}>{statusLabel(event.status)}</Badge>
              </td>
              <td className="cell-primary">
                <div className="cell-title" title={event.type}>
                  <code>{event.type}</code>
                </div>
                <div className="cell-sub">
                  {event.source ? `via ${event.source}` : 'No source'}
                  {latency && ` · ${latency}`}
                </div>
              </td>
              <td className="cell-nowrap">{serviceLabel(event.service)}</td>
              <td className="col-optional cell-truncate" title={event.user?.email || undefined}>
                {userLabel(event.user)}
              </td>
              <td className="cell-nowrap">
                <RelativeTime value={event.timestamp} now={now} />
              </td>
              <td className="col-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onSelect(event)} aria-label={detailsLabel(event)}>
                  Details
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
));
EventsTable.displayName = 'EventsTable';

// Phones: stacked cards; the whole card is one button so the tap target is large.
export const EventCardList = memo(({ events, now, onSelect, label }) => (
  <ul className="record-list" aria-label={label}>
    {events.map((event) => (
      <li key={event.id}>
        <button type="button" className="record-card record-card--button" onClick={() => onSelect(event)} aria-label={detailsLabel(event)}>
          <span className="record-card-top">
            <Badge type={event.status}>{statusLabel(event.status)}</Badge>
            <RelativeTime value={event.timestamp} now={now} className="record-card-time" />
          </span>
          <code className="record-card-title">{event.type}</code>
          <span className="record-card-meta">
            <span>{serviceLabel(event.service)}</span>
            {event.source && <span>via {event.source}</span>}
            <span>{userLabel(event.user)}</span>
          </span>
          <ChevronRight size={16} className="record-card-chevron" aria-hidden="true" />
        </button>
      </li>
    ))}
  </ul>
));
EventCardList.displayName = 'EventCardList';
