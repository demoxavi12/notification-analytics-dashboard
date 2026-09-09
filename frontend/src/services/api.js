import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration & standardized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthEndpoint =
        error.config.url?.includes('/auth/login') ||
        error.config.url?.includes('/auth/register');

      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?expired=true';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Service API abstractions
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const eventsApi = {
  getEvents: (params) => api.get('/events', { params }),
  getEventById: (id) => api.get(`/events/${id}`),
  getEventStats: () => api.get('/events/stats'),
  createEvent: (data) => api.post('/events', data),
  simulateEvent: (serviceType) => api.post('/events/simulate', { serviceType }),
};

export const notificationsApi = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getStats: () => api.get('/notifications/stats'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  createNotification: (data) => api.post('/notifications', data),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

export const analyticsApi = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
  getTimeSeries: (params) => api.get('/analytics/timeseries', { params }),
  getDistributions: (params) => api.get('/analytics/distributions', { params }),
};

export const usersApi = {
  getUsers: (params) => api.get('/users', { params }),
  getUserById: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
};

export const healthApi = {
  checkHealth: () => api.get('/health'),
};

export default api;
