import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLogoutEvent = () => {
      logout();
    };
    window.addEventListener('auth:logout', handleLogoutEvent);
    
    const token = localStorage.getItem('audium_token');
    const userId = localStorage.getItem('audium_userId');
    if (token && userId) {
      setUser({ token, userId });
    }
    setLoading(false);
    
    return () => window.removeEventListener('auth:logout', handleLogoutEvent);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.token && res.userId && res.refreshToken) {
        localStorage.setItem('audium_token', res.token);
        localStorage.setItem('audium_refresh_token', res.refreshToken);
        localStorage.setItem('audium_userId', res.userId);
        setUser({ token: res.token, userId: res.userId });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (e) {
      console.error("API login failed:", e);
      // Re-throw the error so the UI can display it
      throw new Error(e.message || "Authentication failed");
    }
  };

  const register = async (email, password) => {
    try {
      const res = await api.post('/auth/register', { email, password });
      if (res.userId) {
        // Automatically login after successful registration
        await login(email, password);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (e) {
      console.error("API registration failed:", e);
      throw new Error(e.message || "Registration failed");
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('audium_refresh_token');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch (err) {
        console.error("Logout API failed", err);
      }
    }
    localStorage.removeItem('audium_token');
    localStorage.removeItem('audium_refresh_token');
    localStorage.removeItem('audium_userId');
    localStorage.removeItem('audium_model_ready');
    setUser(null);
  };

  const value = { user, login, register, logout, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
