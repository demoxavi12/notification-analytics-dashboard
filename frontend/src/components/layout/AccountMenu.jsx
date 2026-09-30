import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import Badge from '../common/Badge';

const Avatar = ({ user, large = false }) => (
  <span
    className={`avatar${user?.role === 'admin' ? ' avatar--admin' : ''}${large ? ' avatar--lg' : ''}`}
    aria-hidden="true"
  >
    {user?.name ? user.name.trim().charAt(0).toUpperCase() : <User size={14} />}
  </span>
);

// Account disclosure menu: a button that reveals a small panel with the signed-in
// identity and sign-out. Uses the disclosure pattern (aria-expanded/aria-controls)
// rather than role="menu", so plain Tab navigation works inside it.
const AccountMenu = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signOutLockRef = useRef(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);
  const panelId = useId();

  const isAdmin = user?.role === 'admin';
  const displayName = user?.name || 'Account';

  // Listeners exist only while the panel is open and are always cleaned up.
  useEffect(() => {
    if (!isOpen) return undefined;

    firstItemRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  // Close when keyboard focus moves outside the menu (e.g. Tab past the last item).
  const handleBlur = (event) => {
    if (isOpen && !containerRef.current?.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  const handleSignOut = async () => {
    // Ref guard blocks double clicks before the disabled state re-renders.
    if (signOutLockRef.current) return;
    signOutLockRef.current = true;
    setIsSigningOut(true);
    // AuthContext clears the session; ProtectedRoute then redirects to /login and
    // the login page shows its "signed out" confirmation. No manual navigate needed.
    await logout();
  };

  return (
    <div className="account-menu" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="account-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Avatar user={user} />
        <span className="account-trigger-text" aria-hidden="true">
          <span className="account-trigger-name">{displayName}</span>
          <span className="account-trigger-role">{user?.role || 'user'}</span>
        </span>
        <ChevronDown size={14} className="account-trigger-chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div id={panelId} className="account-dropdown">
          <div className="account-dropdown-header">
            <Avatar user={user} large />
            <div className="account-dropdown-identity">
              <span className="account-dropdown-name">{displayName}</span>
              {user?.email && <span className="account-dropdown-email">{user.email}</span>}
              <span>
                <Badge type={isAdmin ? 'info' : 'neutral'}>
                  {isAdmin && <Shield size={11} aria-hidden="true" />}
                  {user?.role || 'user'}
                </Badge>
              </span>
            </div>
          </div>

          <div className="account-dropdown-divider" role="separator" />

          <button
            ref={firstItemRef}
            type="button"
            className="account-dropdown-item account-dropdown-item--danger"
            onClick={handleSignOut}
            // aria-disabled (not disabled) keeps focus on the button so the panel
            // stays open and the "Signing out…" feedback remains visible.
            aria-disabled={isSigningOut}
            aria-busy={isSigningOut}
          >
            <LogOut size={16} aria-hidden="true" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
