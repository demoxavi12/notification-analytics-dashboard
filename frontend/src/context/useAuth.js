import { createContext, useContext } from 'react';

// Kept separate from AuthProvider so the provider file exports only a component
// (required for React Fast Refresh).
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
