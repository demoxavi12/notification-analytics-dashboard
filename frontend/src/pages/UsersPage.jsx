import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FilterX, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import useUrlFilters from '../hooks/useUrlFilters';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import useMediaQuery from '../hooks/useMediaQuery';
import { USER_FILTER_SCHEMA, USER_PAGE_SIZES, USER_ROLES, USER_STATUSES } from '../features/users/usersModel';
import { changeUserRole, changeUserStatus, fetchUsers } from '../features/users/usersService';
import SearchField from '../components/common/SearchField';
import FilterSelect from '../components/common/FilterSelect';
import Pagination from '../components/common/Pagination';
import StateMessage from '../components/common/StateMessage';
import Modal from '../components/common/Modal';
import { UserCardList, UsersTable } from '../components/users/UserResults';
import UserManagePanel from '../components/users/UserManagePanel';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Admin-only page (AdminRoute + backend authorize('admin') on every /users call).
// The backend is the security boundary; this page only offers actions it supports.

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  ...Object.entries(USER_ROLES).map(([value, { label }]) => ({ value, label })),
];

const TableSkeleton = ({ rows }) => (
  <div className="skeleton-list" aria-hidden="true">
    {Array.from({ length: Math.min(rows, 10) }, (_, i) => (
      <div key={i} className="skeleton skeleton-row" />
    ))}
  </div>
);

const UsersPage = () => {
  useDocumentTitle('Users');
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id ? String(currentUser._id) : null;
  const { filters, updateFilters, resetFilters, activeFilterCount } = useUrlFilters(USER_FILTER_SCHEMA);
  const query = usePaginatedQuery(fetchUsers, filters, 'Could not load users.');
  const { updateData, reload } = query;
  const isCompact = useMediaQuery('(max-width: 699.98px)');

  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  const items = query.data?.items;
  const pagination = query.data?.pagination;
  const hasData = Boolean(query.data);

  // Keep the dialog showing the freshest copy of the selected user.
  const selectedUser = useMemo(
    () => (selected ? items?.find((u) => u.id === selected.id) || selected : null),
    [selected, items]
  );

  const pageOutOfRange =
    query.status === 'success' && pagination && pagination.total > 0 && items.length === 0 && pagination.page > pagination.totalPages;
  const lastPage = pagination?.totalPages;
  useEffect(() => {
    if (pageOutOfRange) updateFilters({ page: lastPage });
  }, [pageOutOfRange, lastPage, updateFilters]);

  const applyUpdatedUser = useCallback(
    (updated) => {
      if (!updated) return;
      setSelected(updated);
      updateData((data) => ({ ...data, items: data.items.map((u) => (u.id === updated.id ? updated : u)) }));
      // If the change moves the user out of the current role filter, refresh the list.
      if (filters.role !== 'all' && updated.role !== filters.role) reload();
    },
    [updateData, reload, filters.role]
  );

  // Errors propagate to the panel, which shows them inside the dialog.
  const handleChangeRole = useCallback(
    async (user, role) => {
      const updated = await changeUserRole(user.id, role);
      applyUpdatedUser(updated || { ...user, role });
      setNotice({ tone: 'success', text: `${user.name}’s role is now ${USER_ROLES[role].label}.` });
    },
    [applyUpdatedUser]
  );

  const handleChangeStatus = useCallback(
    async (user, status) => {
      const updated = await changeUserStatus(user.id, status);
      applyUpdatedUser(updated || { ...user, status });
      setNotice({ tone: 'success', text: `${user.name}’s status is now ${USER_STATUSES[status].label}.` });
    },
    [applyUpdatedUser]
  );

  const closeDetails = useCallback(() => setSelected(null), []);

  const resultsLabel = useMemo(() => {
    const parts = [];
    if (filters.q) parts.push(`matching “${filters.q}”`);
    if (filters.role !== 'all') parts.push(`with role ${USER_ROLES[filters.role].label}`);
    return parts.length ? `Users ${parts.join(', ')}` : 'All users';
  }, [filters]);

  let results;
  if (query.status === 'loading' && !hasData) {
    results = <TableSkeleton rows={Number(filters.limit)} />;
  } else if (query.status === 'error') {
    results = (
      <StateMessage
        tone="error"
        announce
        title="Couldn’t load users"
        message={query.isNetworkError ? 'The API server is unreachable. Check that the backend is running, then retry.' : query.error}
        onRetry={reload}
      />
    );
  } else if (items.length === 0) {
    results = (
      <StateMessage
        title={activeFilterCount ? 'No users match these filters' : 'No users yet'}
        message={activeFilterCount ? 'Try a different name, email or role.' : 'Registered accounts will appear here.'}
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
      <UserCardList users={items} currentUserId={currentUserId} onSelect={setSelected} label={resultsLabel} />
    ) : (
      <UsersTable users={items} currentUserId={currentUserId} onSelect={setSelected} caption={resultsLabel} />
    );
  }

  return (
    <div className="list-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">User administration</h1>
          <p className="page-subtitle">Accounts, roles and access status</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={reload}
            className="btn btn-secondary btn-sm"
            disabled={query.status === 'loading'}
            aria-label={query.status === 'loading' ? 'Refreshing users' : 'Refresh users'}
          >
            <RefreshCw size={14} className={query.status === 'loading' ? 'spin' : undefined} aria-hidden="true" />
            <span>Refresh</span>
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

      <section className="card filter-bar" aria-label="User filters">
        <SearchField
          key={filters.q}
          value={filters.q}
          onSearch={(q) => updateFilters({ q })}
          label="Search users by name or email"
          placeholder="Search name or email…"
        />
        <div className="filter-fields">
          <FilterSelect label="Role" value={filters.role} options={ROLE_OPTIONS} onChange={(role) => updateFilters({ role })} />
          {activeFilterCount > 0 && (
            <button type="button" className="btn btn-outline btn-sm filter-reset" onClick={resetFilters}>
              <FilterX size={14} aria-hidden="true" /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </section>

      <section className="results-section" aria-label="User results" aria-busy={query.status === 'loading' || undefined}>
        <div className={query.isRefreshing && query.status !== 'error' ? 'is-refreshing' : undefined}>{results}</div>
        {hasData && query.status !== 'error' && items.length > 0 && (
          <Pagination
            pagination={pagination}
            itemLabel="users"
            onPageChange={(page) => updateFilters({ page })}
            pageSizes={USER_PAGE_SIZES}
            onPageSizeChange={(limit) => updateFilters({ limit: String(limit) })}
            disabled={query.status === 'loading'}
          />
        )}
      </section>

      <Modal isOpen={Boolean(selectedUser)} onClose={closeDetails} title={selectedUser ? `Manage ${selectedUser.name}` : 'Manage user'} maxWidth="560px">
        {selectedUser && (
          <UserManagePanel
            key={selectedUser.id}
            user={selectedUser}
            currentUserId={currentUserId}
            onChangeRole={handleChangeRole}
            onChangeStatus={handleChangeStatus}
          />
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
