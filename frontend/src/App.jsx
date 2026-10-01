import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/protected/ProtectedRoute';
import AdminRoute from './components/protected/AdminRoute';
import DashboardLayout from './layouts/DashboardLayout';

import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import EventsPage from './pages/EventsPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Authenticated Dashboard Core */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />

          {/* Admin Only Route */}
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
