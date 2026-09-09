import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  Eye,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { eventsApi } from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [service, setService] = useState('all');
  const [status, setStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Selected event for detail modal
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Create new event modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    eventType: 'payment.success',
    service: 'payment-service',
    status: 'success',
    metadata: '{\n  "amount": 99.00,\n  "currency": "USD"\n}',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEvents = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await eventsApi.getEvents({
        page,
        limit: pagination.limit,
        search: search || undefined,
        service: service !== 'all' ? service : undefined,
        status: status !== 'all' ? status : undefined,
      });

      setEvents(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(1);
  }, [service, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEvents(1);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(newEvent.metadata);
      } catch (e) {
        alert('Invalid JSON in metadata field');
        setIsSubmitting(false);
        return;
      }

      await eventsApi.createEvent({
        eventType: newEvent.eventType,
        service: newEvent.service,
        status: newEvent.status,
        metadata: parsedMetadata,
      });

      setIsCreateOpen(false);
      fetchEvents(1);
    } catch (err) {
      alert('Event creation failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Events Stream</h1>
          <p className="page-subtitle">
            Centralized application log & pipeline audit trail across services
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchEvents(pagination.page)}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} /> Ingest Event
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Search input */}
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="Search by event type or source..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </form>

          {/* Select Dropdowns */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Service:</span>
              <select
                className="select"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <option value="all">All Services</option>
                <option value="auth-service">Auth Service</option>
                <option value="notification-service">Notification Service</option>
                <option value="payment-service">Payment Service</option>
                <option value="api-gateway">API Gateway</option>
                <option value="system">System Core</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Event Type</th>
              <th>Service</th>
              <th>User</th>
              <th>Source</th>
              <th>Timestamp</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="loading-spinner" />
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No matching events found in stream.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event._id}>
                  <td>
                    <Badge type={event.status}>{event.status}</Badge>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {event.eventType}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {event.service}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {event.userId?.name || (event.userId?.email ? event.userId.email : 'System/Anonymous')}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {event.source || 'web-app'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedEvent(event)}
                      className="btn btn-outline btn-sm"
                      title="Inspect metadata"
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '16px',
          padding: '4px 8px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <div>
          Showing page <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pagination.page}</span> of{' '}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pagination.totalPages}</span> ({pagination.total} total events)
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fetchEvents(pagination.page - 1)}
            disabled={!pagination.hasPrevPage}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            onClick={() => fetchEvents(pagination.page + 1)}
            disabled={!pagination.hasNextPage}
            className="btn btn-secondary btn-sm"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Event Details Inspection Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Event Inspection & Metadata"
      >
        {selectedEvent && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Event Type</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEvent.eventType}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status</div>
                <Badge type={selectedEvent.status}>{selectedEvent.status}</Badge>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Service</div>
                <div>{selectedEvent.service}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Source</div>
                <div>{selectedEvent.source}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Timestamp</div>
                <div style={{ fontSize: '13px' }}>{new Date(selectedEvent.timestamp).toISOString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Event ID</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedEvent._id}</div>
              </div>
            </div>

            <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
              JSON Payload Metadata:
            </div>
            <pre className="code-block">
              {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* Ingest Event Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ingest Custom Event"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="input-group">
            <label className="input-label">Event Type Identifier</label>
            <input
              type="text"
              className="input"
              value={newEvent.eventType}
              onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
              placeholder="e.g. invoice.generated"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Service</label>
            <select
              className="select"
              value={newEvent.service}
              onChange={(e) => setNewEvent({ ...newEvent, service: e.target.value })}
            >
              <option value="payment-service">payment-service</option>
              <option value="notification-service">notification-service</option>
              <option value="auth-service">auth-service</option>
              <option value="api-gateway">api-gateway</option>
              <option value="system">system</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Status</label>
            <select
              className="select"
              value={newEvent.status}
              onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
            >
              <option value="success">success</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">JSON Metadata</label>
            <textarea
              className="input"
              rows={4}
              value={newEvent.metadata}
              onChange={(e) => setNewEvent({ ...newEvent, metadata: e.target.value })}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Ingesting...' : 'Ingest Event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EventsPage;
