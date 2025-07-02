import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = () => {
    return localStorage.getItem('access_token') !== null;
  };

  const login = () => {
    // Simplified for demo - in real app this would use Auth0
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('access_token', 'demo-token');
      localStorage.setItem('user', JSON.stringify({ email: 'demo@example.com', name: 'Demo User' }));
      setUser({ email: 'demo@example.com', name: 'Demo User' });
      setLoading(false);
    }, 1000);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: isAuthenticated(),
    login,
    logout,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};