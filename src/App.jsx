import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

const AppContent = () => {
  const { loading, isAuthenticated } = useAuth();

  // Show loading while initializing
  if (loading) {
    return (
      <div className="app-loading">
        <div className="logo">Vibesheets</div>
        <div className="loading-message">
          <i className="fas fa-spinner fa-spin"></i> Initializing...
        </div>
      </div>
    );
  }

  // Handle auth callback (when URL has auth hash parameters)
  if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
    return (
      <div className="app-loading">
        <div className="logo">Vibesheets</div>
        <div className="loading-message">
          <i className="fas fa-spinner fa-spin"></i> Processing authentication...
        </div>
      </div>
    );
  }

  // Route based on current path and authentication status
  const path = window.location.pathname;
  
  if (path === '/dashboard' || path === '/dashboard.html') {
    return isAuthenticated ? <Dashboard /> : <Login />;
  }
  
  // Default to login page, but redirect to dashboard if already authenticated
  if (isAuthenticated && (path === '/' || path === '/index.html')) {
    // Use setTimeout to avoid hydration issues
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 0);
    
    return (
      <div className="app-loading">
        <div className="logo">Vibesheets</div>
        <div className="loading-message">
          <i className="fas fa-spinner fa-spin"></i> Redirecting to dashboard...
        </div>
      </div>
    );
  }
  
  return <Login />;
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;