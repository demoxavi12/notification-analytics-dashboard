import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Shield, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../common/Badge';

const Navbar = ({ onToggleMobileSidebar, unreadCount = 0 }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left side toggle / title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onToggleMobileSidebar}
          className="btn btn-outline"
          style={{ padding: '6px', display: 'none' }}
          id="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Workspace:</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Production Cloud (US-East)
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary)',
              fontWeight: 600,
            }}
          >
            Live
          </span>
        </div>
      </div>

      {/* Right side user actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Notification Bell with counter */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            position: 'relative',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="View Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: 'var(--error)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: '10px',
                minWidth: '16px',
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User profile card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: user?.role === 'admin' ? 'var(--primary)' : '#6366f1',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : <User size={14} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.name || 'User'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {user?.email}
            </span>
          </div>

          <Badge type={user?.role === 'admin' ? 'info' : 'neutral'}>
            {user?.role === 'admin' && <Shield size={11} />}
            {user?.role}
          </Badge>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="btn btn-outline"
          style={{ padding: '8px 12px' }}
          title="Sign out of account"
        >
          <LogOut size={16} />
          <span style={{ fontSize: '13px' }}>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
