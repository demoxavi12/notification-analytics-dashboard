import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import { healthApi, notificationsApi } from '../services/api';

const DashboardLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [systemHealth, setSystemHealth] = useState({ database: 'checking', redis: 'checking' });
  const location = useLocation();

  // Fetch unread count & system health periodically
  const fetchHeaderData = async () => {
    try {
      const [healthRes, notifRes] = await Promise.allSettled([
        healthApi.checkHealth(),
        notificationsApi.getNotifications({ limit: 1, read: 'false' }),
      ]);

      if (healthRes.status === 'fulfilled') {
        setSystemHealth(healthRes.value.data);
      }

      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data.unreadCount || 0);
      }
    } catch (err) {
      // Background poll silently fails without interruption
    }
  };

  useEffect(() => {
    fetchHeaderData();
    const interval = setInterval(fetchHeaderData, 20000); // 20s refresh
    return () => clearInterval(interval);
  }, [location.pathname]);

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        systemHealth={systemHealth}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          unreadCount={unreadCount}
        />
        <main className="page-wrapper">
          <Outlet context={{ refreshUnreadCount: fetchHeaderData }} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
