import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import useMediaQuery from '../hooks/useMediaQuery';
import { healthApi, notificationsApi } from '../services/api';

const SIDEBAR_ID = 'app-sidebar';
// Below this width the sidebar becomes an off-canvas drawer (tablet + mobile).
const DRAWER_QUERY = '(max-width: 1023.98px)';
const COLLAPSED_STORAGE_KEY = 'pulseops.sidebarCollapsed';
const POLL_INTERVAL_MS = 20000;

const readCollapsedPreference = () => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

// /api/health answers 503 *with* a status body when the DB is down, so a rejected
// request may still carry useful data. No response at all means the API is unreachable.
const toHealthState = (result) => {
  const body = result.status === 'fulfilled' ? result.value.data : result.reason?.response?.data;
  if (body?.database || body?.redis) {
    return { database: body.database, redis: body.redis };
  }
  return { database: 'unreachable', redis: 'unreachable' };
};

const DashboardLayout = () => {
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsedPreference);
  const [unreadCount, setUnreadCount] = useState(0);
  const [systemHealth, setSystemHealth] = useState({ database: 'checking', redis: 'checking' });
  const location = useLocation();

  const menuButtonRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const isMountedRef = useRef(true);

  // Close the drawer when the route changes or the viewport grows past the drawer
  // breakpoint. Adjusting state during render (instead of in an effect) avoids an
  // extra paint with the stale drawer still open.
  const [prevPath, setPrevPath] = useState(location.pathname);
  const [prevIsDrawer, setPrevIsDrawer] = useState(isDrawer);
  if (prevPath !== location.pathname || prevIsDrawer !== isDrawer) {
    setPrevPath(location.pathname);
    setPrevIsDrawer(isDrawer);
    if (mobileNavOpen) setMobileNavOpen(false);
  }

  const drawerOpen = isDrawer && mobileNavOpen;

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Preference just won't persist (e.g. storage blocked).
      }
      return next;
    });
  }, []);

  // Drawer open: move focus into it, lock background scroll, close on Escape.
  // On close: return focus to the menu button if focus was inside the drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;

    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerCloseRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const sidebar = document.getElementById(SIDEBAR_ID);
      const active = document.activeElement;
      if (!active || active === document.body || sidebar?.contains(active)) {
        menuButton?.focus();
      }
    };
  }, [drawerOpen]);

  // Header data (unread count + infrastructure health).
  const fetchHeaderData = useCallback(async () => {
    const [healthRes, notifRes] = await Promise.allSettled([
      healthApi.checkHealth(),
      notificationsApi.getNotifications({ limit: 1, read: 'false' }),
    ]);
    if (!isMountedRef.current) return;

    const nextHealth = toHealthState(healthRes);
    // Keep the same object when nothing changed so the memoized Sidebar doesn't re-render.
    setSystemHealth((prev) =>
      prev.database === nextHealth.database && prev.redis === nextHealth.redis ? prev : nextHealth
    );

    if (notifRes.status === 'fulfilled') {
      setUnreadCount(notifRes.value.data?.unreadCount || 0);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Refresh on navigation (existing behavior). Scheduled as a callback so rapid
  // navigations collapse into one request (the cleanup cancels the pending one).
  useEffect(() => {
    const timeoutId = setTimeout(fetchHeaderData, 0);
    return () => clearTimeout(timeoutId);
  }, [location.pathname, fetchHeaderData]);

  // ... and poll in the background, pausing while the tab is hidden.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) fetchHeaderData();
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden) fetchHeaderData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchHeaderData]);

  // Stable object so pages using useOutletContext() don't re-render for nothing.
  // systemHealth is shared so pages (e.g. the Dashboard) don't poll /health themselves.
  const outletContext = useMemo(
    () => ({ refreshUnreadCount: fetchHeaderData, systemHealth }),
    [fetchHeaderData, systemHealth]
  );

  return (
    <div className="app-container">
      {/* Sidebar navigation (static on desktop, off-canvas drawer below 1024px) */}
      <Sidebar
        id={SIDEBAR_ID}
        isDrawer={isDrawer}
        isOpen={drawerOpen}
        isCollapsed={isCollapsed}
        onClose={closeMobileNav}
        onToggleCollapse={toggleCollapsed}
        systemHealth={systemHealth}
        closeButtonRef={drawerCloseRef}
      />

      {drawerOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileNav} aria-hidden="true" />
      )}

      {/* Main Content Area; inert while the drawer is open so focus stays in the drawer */}
      <div className="main-content" inert={drawerOpen}>
        <Navbar
          sidebarId={SIDEBAR_ID}
          isMobileNavOpen={drawerOpen}
          onOpenMobileNav={openMobileNav}
          menuButtonRef={menuButtonRef}
          unreadCount={unreadCount}
        />
        <main className="page-wrapper" id="main-content">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
