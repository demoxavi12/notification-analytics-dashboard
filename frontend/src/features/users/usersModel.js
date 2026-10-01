// Pure user-management model. Mirrors backend/src/controllers/userController.js:
//   GET /users?search=&role=&page=&limit=   (no status filter on the API)
//   PATCH /users/:id/role   { role: 'admin' | 'user' }        self-demotion is rejected
//   PATCH /users/:id/status { status: active|inactive|suspended } self-deactivation is rejected
// The backend is the authority; the guards below only explain disabled controls.
import { normalizePagination } from '../../utils/records.js';

export const USER_ROLES = {
  user: { label: 'User', description: 'Standard access to their own events and notifications.' },
  admin: { label: 'Admin', description: 'Full access, including user management.' },
};

// What each status does in the backend (login and the auth middleware block both
// `inactive` and `suspended`), stated plainly so admins aren't misled.
export const USER_STATUSES = {
  active: { label: 'Active', description: 'Can sign in and use the app.' },
  inactive: { label: 'Inactive', description: 'Deactivated: cannot sign in or use the API.' },
  suspended: { label: 'Suspended', description: 'Sign-in and all API access are blocked.' },
};

export const USER_PAGE_SIZES = [10, 25, 50];

export const USER_FILTER_SCHEMA = {
  q: { default: '', type: 'text' },
  role: { default: 'all', values: ['all', ...Object.keys(USER_ROLES)] },
  page: { default: 1, type: 'page' },
  limit: { default: '10', values: USER_PAGE_SIZES.map(String) },
};

// Only display-safe fields are kept; anything else in the payload (e.g. a password
// hash, should a malformed response ever include one) is dropped here.
export const normalizeUser = (user) => ({
  id: user?._id ? String(user._id) : null,
  name: typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Unnamed user',
  email: typeof user?.email === 'string' ? user.email : '',
  role: USER_ROLES[user?.role] ? user.role : 'user',
  status: USER_STATUSES[user?.status] ? user.status : 'active',
  createdAt: user?.createdAt || null,
  updatedAt: user?.updatedAt || null,
});

export const normalizeUserList = (list) => (Array.isArray(list) ? list.map(normalizeUser).filter((u) => u.id) : []);

export const normalizeUserPage = (body, requested) => {
  const items = normalizeUserList(body?.data);
  return { items, pagination: normalizePagination(body?.pagination, { ...requested, itemCount: items.length }) };
};

// Returns a human-readable reason when the change would be rejected by the API, else null.
export const roleChangeBlockedReason = (target, nextRole, currentUserId) => {
  if (!target || nextRole === target.role) return 'Choose a different role.';
  if (target.id === currentUserId && nextRole !== 'admin') return 'You can’t remove your own admin access.';
  return null;
};

export const statusChangeBlockedReason = (target, nextStatus, currentUserId) => {
  if (!target || nextStatus === target.status) return 'Choose a different status.';
  if (target.id === currentUserId && nextStatus !== 'active') return 'You can’t deactivate or suspend your own account.';
  return null;
};
