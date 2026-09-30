import { useRef, useState } from 'react';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { Activity, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import PasswordInput from '../components/common/PasswordInput';
import { normalizeEmail, validateEmail } from '../utils/authValidation';
import { getSafeRedirectPath, SESSION_END_REASONS } from '../utils/authSession';

const EMPTY_ERRORS = { email: '', password: '' };

// Demo quick-fill is a development convenience. It is compiled out of production
// builds unless VITE_ENABLE_DEMO_LOGIN=true (e.g. for a hosted demo environment).
// These are the local seed accounts from backend/src/seed/seedData.js, not real credentials.
const DEMO_LOGIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
const DEMO_ACCOUNTS = DEMO_LOGIN_ENABLED
  ? {
      admin: { email: 'admin@saas.local', password: 'AdminPass123!' },
      user: { email: 'user@saas.local', password: 'UserPass123!' },
    }
  : null;

const bannerStyle = {
  padding: '10px 14px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '13px',
  marginBottom: '16px',
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [errorMessage, setErrorMessage] = useState('');

  // Blocks a second submit synchronously (state-based `disabled` can lag a fast double Enter).
  const submitLockRef = useRef(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { login, isAuthenticated, isLoading, signedOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  // Return target: router state (from ProtectedRoute/AdminRoute) or ?from= (from the
  // API client after a session ends). Both are validated to block open redirects.
  const stateFrom = location.state?.from;
  const from = getSafeRedirectPath(
    stateFrom ? `${stateFrom.pathname}${stateFrom.search || ''}` : searchParams.get('from')
  );

  let sessionNotice = null;
  if (searchParams.get('suspended') === 'true') {
    sessionNotice = { tone: 'error', text: SESSION_END_REASONS.suspended };
  } else if (searchParams.get('expired') === 'true') {
    sessionNotice = { tone: 'warning', text: SESSION_END_REASONS.expired };
  } else if (signedOut) {
    sessionNotice = { tone: 'success', text: 'You have been signed out.' };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const normalizedEmail = normalizeEmail(email);
    // Login only checks presence/format; strength rules apply at registration.
    const errors = {
      email: validateEmail(normalizedEmail),
      password: password ? '' : 'Password is required.',
    };

    if (errors.email || errors.password) {
      setFieldErrors(errors);
      setErrorMessage('');
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setEmail(normalizedEmail);
    submitLockRef.current = true;
    setIsSubmitting(true);
    setFieldErrors(EMPTY_ERRORS);
    setErrorMessage('');

    try {
      const res = await login(normalizedEmail, password);
      if (res.success) {
        navigate(from, { replace: true });
        return;
      }
      setErrorMessage(res.error || 'Login failed. Please try again.');
      // Keep the email, clear the password so a retry starts clean.
      if (res.status === 401) {
        setPassword('');
        passwordRef.current?.focus();
      }
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (role) => {
    const account = DEMO_ACCOUNTS?.[role];
    if (!account) return;
    setEmail(account.email);
    setPassword(account.password);
    setFieldErrors(EMPTY_ERRORS);
    setErrorMessage('');
  };

  // Already signed in (e.g. visiting /login directly): go straight to the app.
  // While submitting, handleSubmit performs the navigation itself.
  if (!isLoading && isAuthenticated && !isSubmitting) {
    return <Navigate to={from} replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '12px',
            }}
          >
            <Activity size={28} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Sign in to PulseOps
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-Service Notification & Analytics Dashboard
          </p>
        </div>

        {sessionNotice && (
          <div
            role="status"
            style={{
              ...bannerStyle,
              backgroundColor: `var(--${sessionNotice.tone}-bg)`,
              color: `var(--${sessionNotice.tone})`,
            }}
          >
            {sessionNotice.text}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          <div className="input-group">
            <label className="input-label" htmlFor="login-email">
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                className={`input${fieldErrors.email ? ' input-invalid' : ''}`}
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                  setErrorMessage('');
                }}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(fieldErrors.email) || undefined}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                required
              />
              <Mail
                size={16}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
            {fieldErrors.email && (
              <span id="login-email-error" className="field-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" htmlFor="login-password">
              Password
            </label>
            <PasswordInput
              id="login-password"
              inputRef={passwordRef}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                setErrorMessage('');
              }}
              autoComplete="current-password"
              invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              required
            />
            {fieldErrors.password && (
              <span id="login-password-error" className="field-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 16px', fontSize: '15px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              'Authenticating...'
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Quick Fill Helper Buttons (development / explicitly enabled demo only) */}
        {DEMO_ACCOUNTS && (
          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '10px' }}>
              Quick Demo Logins (1-Click)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('admin')}
                title={DEMO_ACCOUNTS.admin.email}
                disabled={isSubmitting}
              >
                <ShieldCheck size={14} color="var(--primary)" /> Admin Demo
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('user')}
                title={DEMO_ACCOUNTS.user.email}
                disabled={isSubmitting}
              >
                <User size={14} color="var(--success)" /> User Demo
              </button>
            </div>
          </div>
        )}

        {/* Footer link */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
