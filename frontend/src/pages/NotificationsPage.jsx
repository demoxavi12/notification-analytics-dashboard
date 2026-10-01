import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCheck, CheckCircle2, FilterX, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import useUrlFilters from '../hooks/useUrlFilters';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import useNow from '../hooks/useNow';
import {
  NOTIFICATION_FILTER_SCHEMA,
  NOTIFICATION_PAGE_SIZES,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendTestNotification,
} from '../features/notifications/notificationsService';
import { getApiErrorMessage } from '../services/api';
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../utils/domainLabels';
import { formatCount } from '../utils/formatters';
import SearchField from '../components/common/SearchField';
import FilterSelect from '../components/common/FilterSelect';
import Pagination from '../components/common/Pagination';
import StateMessage from '../components/common/StateMessage';
import Modal from '../components/common/Modal';
import NotificationList from '../components/notifications/NotificationList';
import NotificationDetails from '../components/notifications/NotificationDetails';
import TestNotificationForm from '../components/notifications/TestNotificationForm';
import useDocumentTitle from '../hooks/useDocumentTitle';

const toOptions = (map, allLabel) => [
  { value: 'all', label: allLabel },
  ...Object.entries(map).map(([value, { label }]) => ({ value, label })),
];
const TYPE_OPTIONS = toOptions(NOTIFICATION_TYPES, 'All types');
const CHANNEL_OPTIONS = toOptions(NOTIFICATION_CHANNELS, 'All channels');
const STATUS_OPTIONS = toOptions(DELIVERY_STATUSES, 'All deliveries');
const SCOPE_OPTIONS = [
  { value: 'all', label: 'All recipients' },
  { value: 'mine', label: 'Only mine' },
];
const READ_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'false', label: 'Unread' },
  { value: 'true', label: 'Read' },
];

const ListSkeleton = ({ rows }) => (
  <div className="skeleton-list" aria-hidden="true">
    {Array.from({ length: Math.min(rows, 8) }, (_, i) => (
      <div key={i} className="skeleton skeleton-card" />
    ))}
  </div>
);

const NotificationsPage = () => {
  useDocumentTitle('Notifications');
  const { isAdmin } = useAuth();
  const { refreshUnreadCount } = useOutletContext() || {};
  const { filters: urlFilters, updateFilters, resetFilters, activeFilterCount } = useUrlFilters(NOTIFICATION_FILTER_SCHEMA);
  // The scope control is admin-only UI; non-admins are always scoped server-side anyway.
  const filters = useMemo(() => (isAdmin ? urlFilters : { ...urlFilters, scope: 'all' }), [isAdmin, urlFilters]);
  const query = usePaginatedQuery(fetchNotifications, filters, 'Could not load notifications.');
  const { updateData } = query; // stable; keeps memoized callbacks stable
  const now = useNow();

  const [pendingIds, setPendingIds] = useState(() => new Set());
  // Synchronous in-flight guard: state updates lag behind rapid double clicks.
  const inFlightRef = useRef(new Set());
  const markAllLockRef = useRef(false);
  const deleteLockRef = useRef(false);
  // After a delete the triggering button no longer exists; move focus to the
  // results region once the list has reloaded so keyboard users keep their place.
  const resultsRef = useRef(null);
  const focusResultsRef = useRef(false);
  const [selected, setSelected] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [notice, setNotice] = useState(null); // { tone: 'success' | 'error', text }

  const items = query.data?.items;
  const pagination = query.data?.pagination;
  const unreadCount = query.data?.unreadCount ?? null;
  const hasData = Boolean(query.data);
  const showRecipient = isAdmin && filters.scope !== 'mine';

  // Keep the open details dialog in sync with list updates (e.g. after mark-read).
  const selectedNotification = useMemo(
    () => (selected ? items?.find((n) => n.id === selected.id) || selected : null),
    [selected, items]
  );

  const pageOutOfRange =
    query.status === 'success' && pagination && pagination.total > 0 && items.length === 0 && pagination.page > pagination.totalPages;
  const lastPage = pagination?.totalPages;
  useEffect(() => {
    if (pageOutOfRange) updateFilters({ page: lastPage });
  }, [pageOutOfRange, lastPage, updateFilters]);

  useEffect(() => {
    if (focusResultsRef.current && query.status === 'success') {
      focusResultsRef.current = false;
      resultsRef.current?.focus();
    }
  }, [query.status, query.data]);

  const setPending = useCallback((id, isPending) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setItemRead = useCallback(
    (id, read, unread) =>
      updateData((data) => ({
        ...data,
        items: data.items.map((n) => (n.id === id ? { ...n, read } : n)),
        unreadCount: unread ?? data.unreadCount,
      })),
    [updateData]
  );

  const handleMarkRead = useCallback(
    async (notification) => {
      if (inFlightRef.current.has(notification.id)) return;
      inFlightRef.current.add(notification.id);
      setPending(notification.id, true);
      setNotice(null);
      setItemRead(notification.id, true); // optimistic
      try {
        const result = await markNotificationRead(notification.id);
        setItemRead(notification.id, true, result.unreadCount);
        refreshUnreadCount?.();
      } catch (err) {
        setItemRead(notification.id, false);
        setNotice({ tone: 'error', text: getApiErrorMessage(err, 'Could not mark the notification as read.') });
      } finally {
        inFlightRef.current.delete(notification.id);
        setPending(notification.id, false);
      }
    },
    [setPending, setItemRead, refreshUnreadCount]
  );

  const handleMarkAllRead = async () => {
    if (markAllLockRef.current) return;
    markAllLockRef.current = true;
    setIsMarkingAll(true);
    setNotice(null);
    try {
      await markAllNotificationsRead();
      setNotice({ tone: 'success', text: 'All of your notifications are marked as read.' });
      query.reload();
      refreshUnreadCount?.();
    } catch (err) {
      setNotice({ tone: 'error', text: getApiErrorMessage(err, 'Could not mark notifications as read.') });
    } finally {
      markAllLockRef.current = false;
      setIsMarkingAll(false);
    }
  };

  const openDelete = useCallback((notification) => {
    setDeleteState({ busy: false, error: '' });
    setPendingDelete(notification);
  }, []);
  const closeDelete = useCallback(() => {
    if (!deleteState.busy) setPendingDelete(null);
  }, [deleteState.busy]);

  const confirmDelete = async () => {
    if (!pendingDelete || deleteLockRef.current) return;
    deleteLockRef.current = true;
    setDeleteState({ busy: true, error: '' });
    try {
      await deleteNotification(pendingDelete.id);
      setNotice({ tone: 'success', text: `Deleted “${pendingDelete.title}”.` });
      if (selected?.id === pendingDelete.id) setSelected(null);
      focusResultsRef.current = true;
      setPendingDelete(null);
      setDeleteState({ busy: false, error: '' });
      // Removing the only item on a later page would leave an empty page: step back.
      if (items.length === 1 && filters.page > 1) updateFilters({ page: filters.page - 1 });
      else query.reload();
      refreshUnreadCount?.();
    } catch (err) {
      setDeleteState({ busy: false, error: getApiErrorMessage(err, 'The notification could not be deleted.') });
    } finally {
      deleteLockRef.current = false;
    }
  };

  const handleSendTest = async (payload) => {
    await sendTestNotification(payload); // errors are shown inside the form
    setIsTestOpen(false);
    setNotice({ tone: 'success', text: `Sent “${payload.title}” to your account.` });
    if (filters.page !== 1) updateFilters({ page: 1 });
    else query.reload();
    refreshUnreadCount?.();
  };

  const closeDetails = useCallback(() => setSelected(null), []);
  const closeTest = useCallback(() => setIsTestOpen(false), []);
  // Scope is not a "filter" for non-admins, so don't count it.
  const filterCount = isAdmin ? activeFilterCount : activeFilterCount - (urlFilters.scope !== 'all' ? 1 : 0);

  let results;
  if (query.status === 'loading' && !hasData) {
    results = <ListSkeleton rows={Number(filters.limit)} />;
  } else if (query.status === 'error') {
    results = (
      <StateMessage
        tone="error"
        announce
        title="Couldn’t load notifications"
        message={query.isNetworkError ? 'The API server is unreachable. Check that the backend is running, then retry.' : query.error}
        onRetry={query.reload}
      />
    );
  } else if (items.length === 0) {
    results = (
      <StateMessage
        title={filterCount ? 'No notifications match these filters' : 'No notifications yet'}
        message={filterCount ? 'Try a different search term or filter.' : 'New notifications will appear here.'}
        action={
          filterCount ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
              <FilterX size={14} aria-hidden="true" /> Clear filters
            </button>
          ) : null
        }
      />
    );
  } else {
    results = (
      <NotificationList
        notifications={items}
        now={now}
        label="Notifications"
        showRecipient={showRecipient}
        pendingIds={pendingIds}
        onOpen={setSelected}
        onMarkRead={handleMarkRead}
        onDelete={openDelete}
      />
    );
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications Center</h1>
          <p className="page-subtitle">
            Delivery log, multi-channel alerts and read state
            {unreadCount !== null && (
              <>
                {' · '}
                <strong className="unread-summary">
                  {unreadCount === 0 ? 'You’re all caught up' : `${formatCount(unreadCount)} unread for you`}
                </strong>
              </>
            )}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={query.reload}
            className="btn btn-secondary btn-sm"
            disabled={query.status === 'loading'}
            aria-label={query.status === 'loading' ? 'Refreshing notifications' : 'Refresh notifications'}
          >
            <RefreshCw size={14} className={query.status === 'loading' ? 'spin' : undefined} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="btn btn-secondary btn-sm"
            disabled={isMarkingAll || !unreadCount}
            title="Marks all of your own notifications as read"
          >
            <CheckCheck size={14} aria-hidden="true" />
            {isMarkingAll ? 'Marking…' : 'Mark all mine read'}
          </button>
          <button type="button" onClick={() => setIsTestOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={14} aria-hidden="true" /> Test notification
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`dashboard-notice dashboard-notice--${notice.tone === 'error' ? 'error' : 'success'}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.tone === 'error' ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{notice.text}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="card filter-bar" aria-label="Notification filters">
        <SearchField
          key={filters.q}
          value={filters.q}
          onSearch={(q) => updateFilters({ q })}
          label="Search notifications by title or message"
          placeholder="Search title or message…"
        />
        <div className="filter-fields">
          <fieldset className="segmented segmented--filter">
            <legend className="filter-label">Read state</legend>
            <div className="segmented-options">
              {READ_OPTIONS.map((option) => (
                <label key={option.value} className="segmented-option">
                  <input
                    type="radio"
                    className="sr-only"
                    name="notification-read-filter"
                    value={option.value}
                    checked={filters.read === option.value}
                    onChange={() => updateFilters({ read: option.value })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <FilterSelect label="Type" value={filters.type} options={TYPE_OPTIONS} onChange={(type) => updateFilters({ type })} />
          <FilterSelect label="Channel" value={filters.channel} options={CHANNEL_OPTIONS} onChange={(channel) => updateFilters({ channel })} />
          <FilterSelect label="Delivery" value={filters.status} options={STATUS_OPTIONS} onChange={(status) => updateFilters({ status })} />
          {isAdmin && (
            <FilterSelect label="Recipients" value={filters.scope} options={SCOPE_OPTIONS} onChange={(scope) => updateFilters({ scope })} />
          )}
          {filterCount > 0 && (
            <button type="button" className="btn btn-outline btn-sm filter-reset" onClick={resetFilters}>
              <FilterX size={14} aria-hidden="true" /> Clear filters ({filterCount})
            </button>
          )}
        </div>
      </section>

      <section
        ref={resultsRef}
        tabIndex={-1}
        className="results-section"
        aria-label="Notification results"
        aria-busy={query.status === 'loading' || undefined}
      >
        <div className={query.isRefreshing && query.status !== 'error' ? 'is-refreshing' : undefined}>{results}</div>
        {hasData && query.status !== 'error' && items.length > 0 && (
          <Pagination
            pagination={pagination}
            itemLabel="notifications"
            onPageChange={(page) => updateFilters({ page })}
            pageSizes={NOTIFICATION_PAGE_SIZES}
            onPageSizeChange={(limit) => updateFilters({ limit: String(limit) })}
            disabled={query.status === 'loading'}
          />
        )}
      </section>

      <Modal
        isOpen={Boolean(selectedNotification)}
        onClose={closeDetails}
        title={selectedNotification?.title || 'Notification'}
        maxWidth="600px"
        footer={
          selectedNotification && (
            <>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  // Close details first so only one dialog (and one Escape handler) is active.
                  const target = selectedNotification;
                  setSelected(null);
                  openDelete(target);
                }}
              >
                Delete
              </button>
              {!selectedNotification.read && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleMarkRead(selectedNotification)}
                  disabled={pendingIds.has(selectedNotification.id)}
                >
                  Mark as read
                </button>
              )}
            </>
          )
        }
      >
        {selectedNotification && <NotificationDetails notification={selectedNotification} showRecipient={isAdmin} />}
      </Modal>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={closeDelete}
        title="Delete notification?"
        maxWidth="440px"
        footer={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={closeDelete} disabled={deleteState.busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={deleteState.busy} data-autofocus>
              {deleteState.busy ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        {pendingDelete && (
          <>
            <p className="detail-message">
              “{pendingDelete.title}” will be permanently removed. This can’t be undone.
            </p>
            {deleteState.error && (
              <div className="form-alert" role="alert">
                {deleteState.error}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal isOpen={isTestOpen} onClose={closeTest} title="Send test notification" maxWidth="520px">
        <TestNotificationForm onSubmit={handleSendTest} onCancel={closeTest} />
      </Modal>
    </div>
  );
};

export default NotificationsPage;
