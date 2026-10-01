import axios from 'axios';
import { clearStoredSession, getStoredToken, PUBLIC_AUTH_PATHS } from '../utils/authSession';

const api = axios.create({
  // VITE_API_URL is baked in at build time. Without it, dev talks to the local API and
  // production builds use same-origin /api (reverse-proxy setup), never localhost.
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Several requests usually fail together when a token dies; redirect only once.
let isEndingSession = false;

// End the session and send the user to login with a reason banner. The current
// path is kept (and re-validated on the login page) so they can pick up where they were.
const endSession = (reasonParam) => {
  clearStoredSession();
  const { pathname, search } = window.location;
  if (isEndingSession || PUBLIC_AUTH_PATHS.includes(pathname)) return;
  isEndingSession = true;
  const params = new URLSearchParams({ [reasonParam]: 'true', from: `${pathname}${search}` });
  window.location.href = `/login?${params.toString()}`;
};

// Response interceptor to handle token expiration & standardized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Login/register errors are credential problems, and a 401 on logout just means
    // the token was already invalid — none of these end a live session.
    const isAuthEndpoint =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register') ||
      error.config?.url?.includes('/auth/logout');

    if (!isAuthEndpoint) {
      if (status === 401) {
        endSession('expired');
      } else if (status === 403 && error.response.data?.error?.code === 'ACCOUNT_SUSPENDED') {
        // Every request from a suspended account fails, so the session is dead.
        // Other 403s (e.g. INSUFFICIENT_PERMISSIONS) are per-request and left to callers.
        endSession('suspended');
      } else if (status === 403 && error.response.data?.error?.code === 'ACCOUNT_INACTIVE') {
        // Deactivated accounts lose access the same way.
        endSession('inactive');
      }
    }
    return Promise.reject(error);
  }
);

// User-facing error messages live in a pure module (unit-tested); re-exported here so
// existing imports keep working.
export { getApiErrorMessage } from '../utils/apiErrors';

// Service API abstractions
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const eventsApi = {
  // Optional `config` (e.g. { signal }) lets callers cancel superseded list requests.
  getEvents: (params, config) => api.get('/events', { params, ...config }),
  getEventById: (id) => api.get(`/events/${id}`),
  getEventStats: () => api.get('/events/stats'),
  createEvent: (data) => api.post('/events', data),
  simulateEvent: (serviceType) => api.post('/events/simulate', { serviceType }),
};

export const notificationsApi = {
  getNotifications: (params, config) => api.get('/notifications', { params, ...config }),
  getStats: () => api.get('/notifications/stats'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  createNotification: (data) => api.post('/notifications', data),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

export const analyticsApi = {
  getOverview: (params, config) => api.get('/analytics/overview', { params, ...config }),
  getTimeSeries: (params, config) => api.get('/analytics/timeseries', { params, ...config }),
  getDistributions: (params, config) => api.get('/analytics/distributions', { params, ...config }),
};

export const usersApi = {
  getUsers: (params, config) => api.get('/users', { params, ...config }),
  getUserById: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
};

export const healthApi = {
  checkHealth: () => api.get('/health'),
};

export default api;
