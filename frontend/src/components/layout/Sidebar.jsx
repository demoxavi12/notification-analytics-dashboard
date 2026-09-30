import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Bell,
  Users,
  Server,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

// adminOnly items are hidden from non-admins purely for UX. Real authorization is
// enforced by the backend (authorize('admin')) and the AdminRoute guard.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/events', label: 'Events Feed', icon: Activity },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/users', label: 'Users Management', icon: Users, adminOnly: true },
];

// Map raw health strings to a dot style + human label (never color alone).
const describeService = (service, value) => {
  if (value === 'connected') return { tone: 'ok', text: 'Connected' };
  if (value === 'checking' || !value) return { tone: 'unknown', text: 'Checking…' };
  if (value === 'unreachable') return { tone: 'down', text: 'Status unavailable' };
  // Redis has an in-memory fallback, so losing it degrades rather than breaks the app.
  if (service === 'redis') return { tone: 'warn', text: 'Fallback mode' };
  return { tone: 'down', text: 'Disconnected' };
};

const TONE_CLASS = { ok: 'status-dot--ok', warn: 'status-dot--warn', down: 'status-dot--down', unknown: '' };

const StatusRow = ({ icon: Icon, name, service, value }) => {
  const { tone, text } = describeService(service, value);
  return (
    <li className="sidebar-status-item" title={`${name}: ${text}`}>
      <span className="sidebar-status-name">
        <Icon size={13} aria-hidden="true" />
        <span className="sidebar-status-text">{name}</span>
        <span className="sr-only">: {text}</span>
      </span>
      <span className={`status-dot ${TONE_CLASS[tone]}`} aria-hidden="true" />
    </li>
  );
};

const Sidebar = ({
  id,
  isDrawer,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
  systemHealth,
  closeButtonRef,
}) => {
  const { isAdmin } = useAuth();
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const collapsed = !isDrawer && isCollapsed;

  const className = [
    'sidebar',
    collapsed && 'sidebar--collapsed',
    isDrawer && isOpen && 'sidebar--open',
  ]
    .filter(Boolean)
    .join(' ');

  // As an open drawer it behaves like a modal dialog; otherwise it's a plain landmark.
  const drawerProps =
    isDrawer && isOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation menu' } : {};

  return (
    <aside id={id} className={className} {...drawerProps}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <Activity size={22} />
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">PulseOps SaaS</div>
          <div className="sidebar-brand-tagline">Events &amp; Notifications</div>
        </div>

        <button
          type="button"
          className="icon-btn sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls={id}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <button
          type="button"
          ref={closeButtonRef}
          className="icon-btn sidebar-close-btn"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section-label" aria-hidden="true">
          Main Menu
        </div>

        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="sidebar-link"
            title={collapsed ? label : undefined}
            onClick={isDrawer ? onClose : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* System Status footer widget */}
      <section className="sidebar-status" aria-label="Infrastructure status">
        <div
          className="sidebar-status-title sidebar-section-label"
          style={{ padding: 0, marginBottom: '8px' }}
          aria-hidden="true"
        >
          Infrastructure
        </div>
        <ul className="sidebar-status-list">
          <StatusRow icon={Database} name="MongoDB" service="database" value={systemHealth?.database} />
          <StatusRow icon={Server} name="Redis Cache" service="redis" value={systemHealth?.redis} />
        </ul>
      </section>
    </aside>
  );
};

// Re-renders only when its props (or auth) actually change, not on every layout render.
export default memo(Sidebar);
