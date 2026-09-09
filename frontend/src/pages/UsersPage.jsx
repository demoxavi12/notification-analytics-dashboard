import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  User,
  ShieldAlert,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/common/Badge';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const { user: currentAuthUser } = useAuth();

  const fetchUsers = async (page = 1) => {
    setIsLoading(true);
    setActionError('');
    try {
      const res = await usersApi.getUsers({
        page,
        limit: pagination.limit,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });

      setUsers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setActionError(err.response?.data?.error?.message || 'Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setActionSuccess('');
    setActionError('');

    try {
      await usersApi.updateRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
      setActionSuccess(`User role updated to ${newRole}`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to update user role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionSuccess('');
    setActionError('');

    try {
      await usersApi.updateStatus(userId, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u))
      );
      setActionSuccess(`User status updated to ${newStatus}`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Failed to update user status');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Administration (RBAC)</h1>
          <p className="page-subtitle">
            Manage organization members, permission tiers, and access credentials
          </p>
        </div>

        <button
          onClick={() => fetchUsers(pagination.page)}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={14} className={isLoading ? 'loading-spinner' : ''} />
          Refresh Directory
        </button>
      </div>

      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <CheckCircle size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <ShieldAlert size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="Search user by name or email..."
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Filter by Role:</span>
            <select
              className="select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators Only</option>
              <option value="user">Standard Users Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="loading-spinner" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No users found matching query.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = currentAuthUser?._id === u._id;
                return (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: u.role === 'admin' ? 'var(--primary)' : '#6366f1',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.name} {isSelf && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ID: {u._id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: 'var(--text-secondary)' }}>
                      {u.email}
                    </td>

                    <td>
                      <Badge type={u.role === 'admin' ? 'info' : 'neutral'}>
                        {u.role === 'admin' && <Shield size={11} />}
                        {u.role}
                      </Badge>
                    </td>

                    <td>
                      <Badge type={u.status || 'active'}>{u.status || 'active'}</Badge>
                    </td>

                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => handleRoleToggle(u._id, u.role)}
                          disabled={isSelf}
                          className="btn btn-outline btn-sm"
                          title={isSelf ? 'Cannot change your own role' : `Switch to ${u.role === 'admin' ? 'user' : 'admin'}`}
                        >
                          {u.role === 'admin' ? 'Demote to User' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleStatusToggle(u._id, u.status || 'active')}
                          disabled={isSelf}
                          className={`btn btn-sm ${u.status === 'suspended' ? 'btn-secondary' : 'btn-danger'}`}
                          title={isSelf ? 'Cannot suspend your own account' : 'Toggle account status'}
                        >
                          {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pagination.totalPages}</span> ({pagination.total} total members)
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fetchUsers(pagination.page - 1)}
            disabled={!pagination.hasPrevPage}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            onClick={() => fetchUsers(pagination.page + 1)}
            disabled={!pagination.hasNextPage}
            className="btn btn-secondary btn-sm"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
