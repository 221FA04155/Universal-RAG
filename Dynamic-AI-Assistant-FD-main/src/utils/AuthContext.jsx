import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../utils/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Race the auth check against a 5-second timeout to prevent stuck "Connecting..." state
      const authPromise = authAPI.checkAuth();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timed out')), 5000)
      );

      const result = await Promise.race([authPromise, timeoutPromise]);

      if (result.authenticated) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      // On timeout or any error, treat as unauthenticated and proceed
      console.warn('Auth check failed or timed out:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password) => {
    try {
      setError(null);
      await authAPI.signup(email, password);
      // After signup, login automatically
      await login(email, password);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const result = await authAPI.login(email, password);
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      signup,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};
