import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { loading, login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    window.location.href = '/dashboard';
    return null;
  }

  const handleLogin = () => {
    login();
  };

  return (
    <div style={{
      fontFamily: "'Poppins', 'Segoe UI', Arial, sans-serif",
      background: 'linear-gradient(135deg, #43cea2, #185a9d)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 60px',
      color: '#fff',
      margin: 0
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '16px 32px',
        borderRadius: '12px',
        fontSize: '20px',
        fontWeight: '600',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        marginBottom: '40px'
      }}>
        Vibesheets
      </div>
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '30px', fontSize: '28px', fontWeight: '600' }}>
          Welcome Back
        </h1>
        
        {loading ? (
          <div style={{ padding: '20px', fontSize: '16px' }}>
            Logging in...
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            style={{
              width: '100%',
              background: 'rgba(67, 206, 162, 0.2)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              border: '1px solid rgba(67, 206, 162, 0.3)',
              padding: '16px 24px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(67, 206, 162, 0.3)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(67, 206, 162, 0.2)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            Sign In (Demo)
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;