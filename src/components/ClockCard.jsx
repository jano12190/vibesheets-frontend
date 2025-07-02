import React, { useState, useEffect } from 'react';

const ClockCard = ({ clockStatus, onClockAction }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const handleClockIn = () => {
    onClockAction('in');
  };

  const handleClockOut = () => {
    onClockAction('out');
  };

  return (
    <div className="card current-time-card">
      <h2>Current Time</h2>
      <div className="time-display">{formatTime(currentTime)}</div>
      <div className="date-display">{formatDate(currentTime)}</div>
      
      <div className="clock-button-container">
        {clockStatus === 'out' ? (
          <button className="clock-in-btn" onClick={handleClockIn}>
            Clock In
          </button>
        ) : (
          <button className="clock-out-btn" onClick={handleClockOut}>
            Clock Out
          </button>
        )}
      </div>
    </div>
  );
};

export default ClockCard;