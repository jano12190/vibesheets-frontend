import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockStatus, setClockStatus] = useState('out');

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/';
      return;
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleClockToggle = () => {
    setClockStatus(clockStatus === 'out' ? 'in' : 'out');
  };

  const dashboardStyle = {
    fontFamily: "'Poppins', 'Segoe UI', Arial, sans-serif",
    background: 'linear-gradient(135deg, #43cea2, #185a9d)',
    minHeight: '100vh',
    padding: '40px 60px',
    color: '#fff',
    margin: 0
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px'
  };

  const logoStyle = {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    color: 'white',
    padding: '16px 32px',
    borderRadius: '12px',
    fontSize: '20px',
    fontWeight: '600',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    textAlign: 'center',
    marginBottom: '30px'
  };

  const buttonStyle = {
    background: clockStatus === 'out' ? '#43cea2' : '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '15px 40px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '20px'
  };

  const logoutBtnStyle = {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '12px 24px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease'
  };

  return (
    <div style={dashboardStyle}>
      <div style={headerStyle}>
        <div style={logoStyle}>Vibesheets</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>Hello, {user?.name || user?.email || 'User'}</span>
          <button style={logoutBtnStyle} onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
        <div style={cardStyle}>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Current Time</h2>
          <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '10px' }}>
            {formatTime(currentTime)}
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '30px' }}>
            {formatDate(currentTime)}
          </div>
          <button 
            style={buttonStyle} 
            onClick={handleClockToggle}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {clockStatus === 'out' ? 'Clock In' : 'Clock Out'}
          </button>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Hours Worked</h2>
          <select style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: 'white',
            padding: '8px 12px',
            fontSize: '14px',
            marginBottom: '10px',
            width: '100%'
          }}>
            <option style={{ background: '#185a9d' }}>Today</option>
            <option style={{ background: '#185a9d' }}>This Week</option>
            <option style={{ background: '#185a9d' }}>This Month</option>
          </select>
          <div style={{ fontSize: '48px', fontWeight: '700', color: '#43cea2', marginTop: '20px' }}>
            8.5h
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Export Timesheet</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>Period:</label>
          <select style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: 'white',
            padding: '10px 15px',
            fontSize: '14px',
            minWidth: '150px'
          }}>
            <option style={{ background: '#185a9d' }}>Select time period</option>
            <option style={{ background: '#185a9d' }}>January 2024</option>
            <option style={{ background: '#185a9d' }}>February 2024</option>
          </select>
          <button style={{
            background: '#43cea2',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            Export PDF
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Time Entries</h2>
          <input 
            type="date" 
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              padding: '10px 15px',
              fontSize: '14px'
            }}
          />
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic', padding: '40px 20px' }}>
          {clockStatus === 'in' ? 'Currently clocked in - time entries will appear here when you clock out.' : 'No time entries for selected date.'}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;