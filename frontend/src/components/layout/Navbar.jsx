import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import AccountMenu from './AccountMenu';

const Navbar = ({ sidebarId, isMobileNavOpen, onOpenMobileNav, menuButtonRef, unreadCount = 0 }) => {
  const unreadLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread';

  return (
    <header className="navbar">
      {/* Left: mobile menu toggle + workspace */}
      <div className="navbar-section">
        <button
          ref={menuButtonRef}
          type="button"
          className="navbar-icon-btn navbar-menu-btn"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          aria-controls={sidebarId}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="navbar-workspace">
          <span className="navbar-workspace-label">Workspace:</span>
          <span className="navbar-workspace-name" title="Production Cloud (US-East)">
            Production Cloud (US-East)
          </span>
          <span className="navbar-live-pill">Live</span>
        </div>
      </div>

      {/* Right: notifications + account */}
      <div className="navbar-section">
        <Link to="/notifications" className="navbar-icon-btn" aria-label={unreadLabel} title="View Notifications">
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="navbar-count-badge" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <AccountMenu />
      </div>
    </header>
  );
};

export default memo(Navbar);
