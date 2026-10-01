import { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { authApi, getApiErrorMessage } from '../services/api';
import {
  TOKEN_KEY,
  USER_KEY,
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  storeSession,
  storeUser,
} from '../utils/authSession';

// Extract { user, token } from an auth response, rejecting malformed payloads
// so we never persist something like the string "undefined" as a token.
const extractSession = (res) => {
  const { user, token } = res?.data?.data || {};
  if (!user || typeof token !== 'string' || !token) {
    throw new Error('Unexpected response from the server.');
  }
  return { user, token };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(getStoredToken);
  // isLoading tracks only the initial session verification; login/register
  // submission state is owned by the pages so routes don't flash a spinner.
  const [isLoading, setIsLoading] = useState(true);
  // True after an explicit logout so the login page can confirm it; route guards
  // redirect before the caller could pass router state, so it lives here.
  const [signedOut, setSignedOut] = useState(false);

  // Validate session on load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          if (res.data?.data?.user) {
            setUser(res.data.data.user);
            storeUser(res.data.data.user);
          }
        } catch (err) {
          // Only discard the session when the server rejected the token/account
          // (401 invalid/expired, 403 suspended, 404 user gone). Network errors,
          // 5xx, 429 etc. say nothing about the token, so keep the cached session.
          const status = err.response?.status;
          if ([401, 403, 404].includes(status)) {
            console.warn('Session verification failed, logging out:', err.message);
            clearStoredSession();
            setUser(null);
            setToken(null);
          } else {
            console.warn('Could not verify session, keeping cached session:', err.message);
          }
        }
      } else if (localStorage.getItem(USER_KEY)) {
        // A user without a token is a stale leftover.
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Keep tabs in sync: logging out (or in as someone else) in one tab applies to all.
  // The "storage" event only fires in the *other* tabs, never the one that wrote.
  useEffect(() => {
    const handleStorage = (event) => {
      // key === null means storage was cleared entirely.
      if (event.key !== null && event.key !== TOKEN_KEY && event.key !== USER_KEY) return;
      const nextToken = getStoredToken();
      setToken(nextToken);
      setUser(nextToken ? getStoredUser() : null);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      const { user: loggedInUser, token: authToken } = extractSession(res);

      storeSession(loggedInUser, authToken);
      setSignedOut(false);
      setUser(loggedInUser);
      setToken(authToken);
      return { success: true, user: loggedInUser };
    } catch (err) {
      const msg = err.isAxiosError
        ? getApiErrorMessage(err, 'Login failed. Please check your credentials.')
        : err.message;
      return { success: false, error: msg, status: err.response?.status, code: err.response?.data?.error?.code };
    }
  };

  const register = async ({ name, email, password }) => {
    try {
      // Explicit payload: public registration must never send a role, even if a
      // caller passes one in. The server assigns the default "user" role.
      const res = await authApi.register({ name, email, password });
      const { user: registeredUser, token: authToken } = extractSession(res);

      storeSession(registeredUser, authToken);
      setSignedOut(false);
      setUser(registeredUser);
      setToken(authToken);
      return { success: true, user: registeredUser };
    } catch (err) {
      const msg = err.isAxiosError
        ? getApiErrorMessage(err, 'Registration failed. Please try again.')
        : err.message;
      return { success: false, error: msg, status: err.response?.status, code: err.response?.data?.error?.code };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout; the local session is cleared regardless.
    } finally {
      clearStoredSession();
      setUser(null);
      setToken(null);
      setSignedOut(true);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    signedOut,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
