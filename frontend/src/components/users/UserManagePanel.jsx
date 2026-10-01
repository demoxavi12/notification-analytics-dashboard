import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DetailList } from '../common/DetailList';
import { RoleBadge, StatusBadge } from './UserResults';
import { getApiErrorMessage } from '../../services/api';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import {
  USER_ROLES,
  USER_STATUSES,
  roleChangeBlockedReason,
  statusChangeBlockedReason,
} from '../../features/users/usersModel';

const TimeValue = ({ value }) =>
  value ? (
    <time dateTime={new Date(value).toISOString()}>
      {formatDateTime(value)} <span className="detail-muted">({formatRelativeTime(value)})</span>
    </time>
  ) : (
    'Unknown'
  );

// Body of the "Manage user" dialog: profile details plus role/status changes.
// Changes are confirmed in place (no stacked dialogs), guarded against double
// submission, and the backend remains the authority on what is allowed.
const UserManagePanel = ({ user, currentUserId, onChangeRole, onChangeStatus, onDone }) => {
  const roleFieldId = useId();
  const statusFieldId = useId();
  const [nextRole, setNextRole] = useState(user.role);
  const [nextStatus, setNextStatus] = useState(user.status);
  const [pending, setPending] = useState(null); // { kind: 'role' | 'status', value }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lockRef = useRef(false);
  // Focus management for the in-place confirm step: the trigger button unmounts when
  // the confirm view appears, so focus moves to Confirm, then back to the trigger.
  const confirmButtonRef = useRef(null);
  const roleTriggerRef = useRef(null);
  const statusTriggerRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    if (pending) confirmButtonRef.current?.focus();
    else if (lastTriggerRef.current === 'role') roleTriggerRef.current?.focus();
    else if (lastTriggerRef.current === 'status') statusTriggerRef.current?.focus();
  }, [pending]);

  const startConfirm = (kind, value) => {
    lastTriggerRef.current = kind;
    setError('');
    setPending({ kind, value });
  };

  const isSelf = user.id === currentUserId;
  const roleBlocked = roleChangeBlockedReason(user, nextRole, currentUserId);
  const statusBlocked = statusChangeBlockedReason(user, nextStatus, currentUserId);

  const confirm = async () => {
    if (!pending || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (pending.kind === 'role') await onChangeRole(user, pending.value);
      else await onChangeStatus(user, pending.value);
      setPending(null);
      onDone?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'The change could not be saved.'));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  if (pending) {
    const isRole = pending.kind === 'role';
    const from = isRole ? USER_ROLES[user.role].label : USER_STATUSES[user.status].label;
    const to = isRole ? USER_ROLES[pending.value] : USER_STATUSES[pending.value];
    const risky = (isRole && pending.value === 'admin') || (!isRole && pending.value !== 'active');
    return (
      <div className="confirm-panel" role="group" aria-labelledby={`${roleFieldId}-confirm`}>
        <h3 id={`${roleFieldId}-confirm`} className="detail-subheading">
          {isRole ? 'Change role?' : 'Change account status?'}
        </h3>
        <p className="detail-message">
          {user.name} ({user.email}) will change from <strong>{from}</strong> to <strong>{to.label}</strong>.
        </p>
        <p className="detail-muted">{to.description}</p>
        {risky && (
          <p className="confirm-warning">
            <AlertTriangle size={14} aria-hidden="true" />
            {isRole ? 'Admins can manage every user, including other admins.' : 'This immediately blocks the user’s access.'}
          </p>
        )}
        {error && (
          <div className="form-alert" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPending(null)} disabled={busy}>
            Back
          </button>
          <button
            type="button"
            className={`btn btn-sm ${risky ? 'btn-danger' : 'btn-primary'}`}
            onClick={confirm}
            disabled={busy}
            ref={confirmButtonRef}
          >
            {busy ? 'Saving…' : `Confirm: ${to.label}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-view">
      <DetailList
        items={[
          { label: 'Name', value: user.name },
          { label: 'Email', value: user.email || '—' },
          { label: 'Role', value: <RoleBadge role={user.role} /> },
          { label: 'Status', value: <StatusBadge status={user.status} /> },
          { label: 'Joined', value: <TimeValue value={user.createdAt} />, wide: true },
          user.updatedAt && user.updatedAt !== user.createdAt && {
            label: 'Last updated',
            value: <TimeValue value={user.updatedAt} />,
            wide: true,
          },
          { label: 'User ID', value: <code className="detail-id">{user.id}</code>, wide: true },
        ]}
      />

      {isSelf && <p className="detail-muted">This is your account. You can’t remove your own admin access or deactivate yourself.</p>}

      <div className="manage-section">
        <label className="input-label" htmlFor={roleFieldId}>
          Role
        </label>
        <div className="manage-row">
          <select id={roleFieldId} className="select" value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
            {Object.entries(USER_ROLES).map(([value, { label }]) => (
              <option key={value} value={value} disabled={isSelf && value !== 'admin'}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            ref={roleTriggerRef}
            onClick={() => startConfirm('role', nextRole)}
            disabled={Boolean(roleBlocked)}
            title={roleBlocked || undefined}
          >
            Change role
          </button>
        </div>
        <p className="detail-muted">{USER_ROLES[nextRole].description}</p>
      </div>

      <div className="manage-section">
        <label className="input-label" htmlFor={statusFieldId}>
          Account status
        </label>
        <div className="manage-row">
          <select id={statusFieldId} className="select" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            {Object.entries(USER_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value} disabled={isSelf && value !== 'active'}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            ref={statusTriggerRef}
            onClick={() => startConfirm('status', nextStatus)}
            disabled={Boolean(statusBlocked)}
            title={statusBlocked || undefined}
          >
            Update status
          </button>
        </div>
        <p className="detail-muted">{USER_STATUSES[nextStatus].description}</p>
      </div>
    </div>
  );
};

export default UserManagePanel;
