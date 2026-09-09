import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate session on load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          if (res.data?.data?.user) {
            setUser(res.data.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.data.user));
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err.message);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      const { user: loggedInUser, token: authToken } = res.data.data;

      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));

      setUser(loggedInUser);
      setToken(authToken);
      setIsLoading(false);
      return { success: true, user: loggedInUser };
    } catch (err) {
      setIsLoading(false);
      const msg = err.response?.data?.error?.message || 'Login failed. Please check credentials.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.register(userData);
      const { user: registeredUser, token: authToken } = res.data.data;

      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(registeredUser));

      setUser(registeredUser);
      setToken(authToken);
      setIsLoading(false);
      return { success: true, user: registeredUser };
    } catch (err) {
      setIsLoading(false);
      const msg = err.response?.data?.error?.message || 'Registration failed.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
