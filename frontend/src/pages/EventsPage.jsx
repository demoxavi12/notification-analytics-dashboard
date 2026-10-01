import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FilterX, Plus, RefreshCw } from 'lucide-react';
import useUrlFilters from '../hooks/useUrlFilters';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import useMediaQuery from '../hooks/useMediaQuery';
import useNow from '../hooks/useNow';
import {
  EVENT_FILTER_SCHEMA,
  EVENT_PAGE_SIZES,
  EVENT_TIME_RANGES,
  fetchEvents,
  ingestEvent,
} from '../features/events/eventsService';
import { EVENT_SERVICES, EVENT_STATUSES } from '../utils/domainLabels';
import SearchField from '../components/common/SearchField';
import FilterSelect from '../components/common/FilterSelect';
import Pagination from '../components/common/Pagination';
import StateMessage from '../components/common/StateMessage';
import Modal from '../components/common/Modal';
import { EventCardList, EventsTable } from '../components/events/EventResults';
import EventDetails from '../components/events/EventDetails';
import IngestEventForm from '../components/events/IngestEventForm';
import useDocumentTitle from '../hooks/useDocumentTitle';

const SERVICE_OPTIONS = [
  { value: 'all', label: 'All services' },
  ...Object.entries(EVENT_SERVICES).map(([value, { label }]) => ({ value, label })),
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(EVENT_STATUSES).map(([value, { label }]) => ({ value, label })),
];
const RANGE_OPTIONS = Object.entries(EVENT_TIME_RANGES).map(([value, { label }]) => ({ value, label }));

const TableSkeleton = ({ rows }) => (
  <div className="skeleton-list" aria-hidden="true">
    {Array.from({ length: Math.min(rows, 10) }, (_, i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </div>
);

const EventsPage = () => {
  useDocumentTitle('Events');
  const { filters, updateFilters, resetFilters, activeFilterCount } = useUrlFilters(EVENT_FILTER_SCHEMA);
  const query = usePaginatedQuery(fetchEvents, filters, 'Could not load events.');
  const isCompact = useMediaQuery('(max-width: 699.98px)');
  const now = useNow();

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const items = query.data?.items;
  const pagination = query.data?.pagination;
  const hasData = Boolean(query.data);
  const isInitialLoading = query.status === 'loading' && !hasData;

  // An out-of-range page (e.g. stale bookmark) jumps to the last real page.
  const pageOutOfRange =
    query.status === 'success' && pagination && pagination.total > 0 && items.length === 0 && pagination.page > pagination.totalPages;
  const lastPage = pagination?.totalPages;
  useEffect(() => {
    if (pageOutOfRange) updateFilters({ page: lastPage });
  }, [pageOutOfRange, lastPage, updateFilters]);

  const resultsLabel = useMemo(() => {
    const parts = [];
    if (filters.q) parts.push(`matching “${filters.q}”`);
    if (filters.service !== 'all') parts.push(EVENT_SERVICES[filters.service].label);
    if (filters.status !== 'all') parts.push(`status ${EVENT_STATUSES[filters.status].label}`);
    if (filters.range !== 'all') parts.push(EVENT_TIME_RANGES[filters.range].label.toLowerCase());
    return parts.length ? `Events ${parts.join(', ')}` : 'All events';
  }, [filters]);

  const closeDetails = useCallback(() => setSelectedEvent(null), []);
  const closeIngest = useCallback(() => setIsIngestOpen(false), []);

  const handleIngest = async (payload) => {
    await ingestEvent(payload); // errors are shown inside the form
    setIsIngestOpen(false);
    setNotice(`Event “${payload.eventType}” was ingested.`);
    if (filters.page !== 1) updateFilters({ page: 1 });
    else query.reload();
  };

  let results;
  if (isInitialLoading) {
    results = <TableSkeleton rows={Number(filters.limit)} />;
  } else if (query.status === 'error') {
    results = (
      <StateMessage
        tone="error"
        announce
        title="Couldn’t load events"
        message={query.isNetworkError ? 'The API server is unreachable. Check that the backend is running, then retry.' : query.error}
        onRetry={query.reload}
      />
    );
  } else if (items.length === 0) {
    results = (
      <StateMessage
        title={activeFilterCount ? 'No events match these filters' : 'No events yet'}
        message={
          activeFilterCount
            ? 'Try a different search term, service, status or time range.'
            : 'Events will appear here as services report them.'
        }
        action={
          activeFilterCount ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
              <FilterX size={14} aria-hidden="true" /> Clear filters
            </button>
          ) : null
        }
      />
    );
  } else {
    results = isCompact ? (
      <EventCardList events={items} now={now} onSelect={setSelectedEvent} label={resultsLabel} />
    ) : (
      <EventsTable events={items} now={now} onSelect={setSelectedEvent} caption={resultsLabel} />
    );
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events Stream</h1>
          <p className="page-subtitle">Centralized application log &amp; pipeline audit trail across services</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={query.reload}
            className="btn btn-secondary btn-sm"
            disabled={query.status === 'loading'}
            aria-label={query.status === 'loading' ? 'Refreshing events' : 'Refresh events'}
          >
            <RefreshCw size={14} className={query.status === 'loading' ? 'spin' : undefined} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button type="button" onClick={() => setIsIngestOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={14} aria-hidden="true" /> Ingest event
          </button>
        </div>
      </div>

      {notice && (
        <div className="dashboard-notice dashboard-notice--success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}

      <section className="card filter-bar" aria-label="Event filters">
        <SearchField
          key={filters.q}
          value={filters.q}
          onSearch={(q) => updateFilters({ q })}
          label="Search events by type or source"
          placeholder="Search type or source…"
        />
        <div className="filter-fields">
          <FilterSelect label="Service" value={filters.service} options={SERVICE_OPTIONS} onChange={(service) => updateFilters({ service })} />
          <FilterSelect label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(status) => updateFilters({ status })} />
          <FilterSelect label="Time" value={filters.range} options={RANGE_OPTIONS} onChange={(range) => updateFilters({ range })} />
          {activeFilterCount > 0 && (
            <button type="button" className="btn btn-outline btn-sm filter-reset" onClick={resetFilters}>
              <FilterX size={14} aria-hidden="true" /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </section>

      <section className="results-section" aria-label="Event results" aria-busy={query.status === 'loading' || undefined}>
        <div className={query.isRefreshing && query.status !== 'error' ? 'is-refreshing' : undefined}>{results}</div>

        {hasData && query.status !== 'error' && items.length > 0 && (
          <Pagination
            pagination={pagination}
            itemLabel="events"
            onPageChange={(page) => updateFilters({ page })}
            pageSizes={EVENT_PAGE_SIZES}
            onPageSizeChange={(limit) => updateFilters({ limit: String(limit) })}
            disabled={query.status === 'loading'}
          />
        )}
      </section>

      <Modal isOpen={Boolean(selectedEvent)} onClose={closeDetails} title="Event details" maxWidth="640px">
        {selectedEvent && <EventDetails event={selectedEvent} />}
      </Modal>

      <Modal isOpen={isIngestOpen} onClose={closeIngest} title="Ingest event" maxWidth="560px">
        <IngestEventForm onSubmit={handleIngest} onCancel={closeIngest} />
      </Modal>
    </div>
  );
};

export default EventsPage;
