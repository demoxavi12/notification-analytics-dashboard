import { usersApi } from '../../services/api';
import { normalizeUser, normalizeUserPage } from './usersModel';

export const fetchUsers = async (filters, { signal } = {}) => {
  const limit = Number(filters.limit);
  const res = await usersApi.getUsers(
    {
      page: filters.page,
      limit,
      search: filters.q || undefined,
      role: filters.role !== 'all' ? filters.role : undefined,
    },
    { signal }
  );
  return normalizeUserPage(res.data, { page: filters.page, limit });
};

export const changeUserRole = async (id, role) => {
  const res = await usersApi.updateRole(id, role);
  return res.data?.data?.user ? normalizeUser(res.data.data.user) : null;
};

export const changeUserStatus = async (id, status) => {
  const res = await usersApi.updateStatus(id, status);
  return res.data?.data?.user ? normalizeUser(res.data.data.user) : null;
};
