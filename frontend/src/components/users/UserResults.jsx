import { memo } from 'react';
import { ChevronRight, Shield } from 'lucide-react';
import Badge from '../common/Badge';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { USER_ROLES, USER_STATUSES } from '../../features/users/usersModel';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const JoinedDate = ({ value }) => {
  if (!value) return <span>Unknown</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>Unknown</span>;
  return (
    <time dateTime={date.toISOString()} title={`${formatDateTime(date)} (${formatRelativeTime(date)})`}>
      {dateFormat.format(date)}
    </time>
  );
};

export const RoleBadge = ({ role }) => (
  <Badge type={role === 'admin' ? 'info' : 'neutral'}>
    {role === 'admin' && <Shield size={11} aria-hidden="true" />}
    {USER_ROLES[role]?.label || role}
  </Badge>
);

export const StatusBadge = ({ status }) => <Badge type={status}>{USER_STATUSES[status]?.label || status}</Badge>;

const YouTag = () => <span className="you-tag">You</span>;

const manageLabel = (user) => `Manage ${user.name} (${user.email})`;

export const UsersTable = memo(({ users, currentUserId, onSelect, caption }) => (
  <div className="table-container results-table">
    <table className="data-table users-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">User</th>
          <th scope="col">Role</th>
          <th scope="col">Status</th>
          <th scope="col" className="col-optional">
            Joined
          </th>
          <th scope="col" className="col-actions">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td className="cell-primary">
              <div className="cell-title" title={user.name}>
                {user.name} {user.id === currentUserId && <YouTag />}
              </div>
              <div className="cell-sub" title={user.email}>
                {user.email}
              </div>
            </td>
            <td>
              <RoleBadge role={user.role} />
            </td>
            <td>
              <StatusBadge status={user.status} />
            </td>
            <td className="col-optional cell-nowrap">
              <JoinedDate value={user.createdAt} />
            </td>
            <td className="col-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onSelect(user)} aria-label={manageLabel(user)}>
                Manage
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));
UsersTable.displayName = 'UsersTable';

export const UserCardList = memo(({ users, currentUserId, onSelect, label }) => (
  <ul className="record-list" aria-label={label}>
    {users.map((user) => (
      <li key={user.id}>
        <button type="button" className="record-card record-card--button" onClick={() => onSelect(user)} aria-label={manageLabel(user)}>
          <span className="record-card-top">
            <span className="record-card-title">
              {user.name} {user.id === currentUserId && <YouTag />}
            </span>
          </span>
          <span className="record-card-meta user-card-email">{user.email}</span>
          <span className="record-card-meta">
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
            <span>
              Joined <JoinedDate value={user.createdAt} />
            </span>
          </span>
          <ChevronRight size={16} className="record-card-chevron" aria-hidden="true" />
        </button>
      </li>
    ))}
  </ul>
));
UserCardList.displayName = 'UserCardList';
