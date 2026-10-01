// Single source of truth for where the client keeps its session, shared by the
// axios client and AuthContext so the two can never drift apart.

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || null;

// A corrupted value must not crash the app on boot.
export const getStoredUser = () => {
  try {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const storeSession = (user, token) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const storeUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const PUBLIC_AUTH_PATHS = ['/login', '/register'];

// Only allow same-origin, in-app paths as post-login redirect targets.
// Rejects absolute URLs, protocol-relative "//evil.com", backslash tricks and
// the auth pages themselves (which would loop).
export const getSafeRedirectPath = (candidate, fallback = '/dashboard') => {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//') || candidate.includes('\\')) return fallback;
  const pathname = candidate.split(/[?#]/)[0];
  if (PUBLIC_AUTH_PATHS.includes(pathname)) return fallback;
  return candidate;
};

// Why the user was sent back to the login page; shown as a banner there.
export const SESSION_END_REASONS = {
  expired: 'Your session expired. Please log in again.',
  suspended: 'Your account has been suspended. Please contact an administrator.',
  inactive: 'Your account has been deactivated. Please contact an administrator.',
};
