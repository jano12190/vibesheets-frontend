import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const TimeEntriesCard = () => {
  const [timeEntries, setTimeEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    // Set default date to today
    const today = formatDate(new Date());
    setSelectedDate(today);
    loadTimeEntries(today);
  }, []);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeOnly = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });
  };

  const formatDateOnly = (dateString) => {
    const date = new Date(dateString + 'T12:00:00'); // Add time to prevent timezone issues
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDuration = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) {
      return clockIn && !clockOut ? 'In Progress' : '--:--';
    }
    
    const start = new Date(clockIn.timestamp);
    const end = new Date(clockOut.timestamp);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours.toFixed(2) + 'h';
  };

  const loadTimeEntries = async (date = null) => {
    try {
      setLoading(true);
      const filterDate = date || selectedDate || formatDate(new Date());
      
      const response = await apiService.getTimesheets({
        start_date: filterDate,
        end_date: filterDate
      });
      
      if (response.ok) {
        const data = await response.json();
        const entries = data.entries || data.timesheets || [];
        setTimeEntries(entries);
      }
    } catch (error) {
      console.error('Failed to load time entries:', error);
      setTimeEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    if (newDate) {
      loadTimeEntries(newDate);
    }
  };

  const deleteTimeEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this time entry? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await apiService.deleteTimeEntry(entryId);
      
      if (response.ok) {
        // Show success message briefly then reload
        setTimeEntries([]);
        setLoading(true);
        
        setTimeout(() => {
          loadTimeEntries();
        }, 1000);
      } else {
        const error = await response.json();
        alert('Failed to delete time entry: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Failed to delete time entry. Please try again.');
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntry({
      ...entry,
      clockInTime: entry.clockIn ? entry.clockIn.timestamp : '',
      clockOutTime: entry.clockOut ? entry.clockOut.timestamp : ''
    });
  };

  const cancelEdit = () => {
    setEditingEntry(null);
  };

  const saveEdit = async () => {
    try {
      const { clockInTime, clockOutTime } = editingEntry;
      
      if (!clockInTime && !clockOutTime) {
        alert('Please enter at least one time.');
        return;
      }

      // Calculate hours if both times are provided
      let hours = 0;
      if (clockInTime && clockOutTime) {
        const start = new Date(clockInTime);
        const end = new Date(clockOutTime);
        hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      const response = await apiService.updateTimesheet({
        timestamp: editingEntry.id,
        hours: hours,
        clock_in_timestamp: clockInTime,
        clock_out_timestamp: clockOutTime
      });

      if (response.ok) {
        setEditingEntry(null);
        loadTimeEntries();
      } else {
        const error = await response.json();
        alert('Failed to update times: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating times:', error);
      alert('Failed to update times. Please try again.');
    }
  };

  const convertTo24Hour = (time12h) => {
    if (!time12h || time12h === '--:--') return '';
    
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const renderTimeEntries = () => {
    if (loading) {
      return <div className="loading-entries">Loading time entries...</div>;
    }

    if (!timeEntries.length) {
      return <div className="no-entries">No time entries found for selected date</div>;
    }

    // Handle both formats: direct entries array or grouped by date
    let entries = [];
    if (Array.isArray(timeEntries)) {
      if (timeEntries.length > 0 && timeEntries[0].entries) {
        // Grouped format: flatten all entries from all dates
        entries = timeEntries.flatMap(day => day.entries || []);
      } else {
        // Direct entries format
        entries = timeEntries;
      }
    }

    if (!entries.length) {
      return <div className="no-entries">No time entries found for selected date</div>;
    }

    // Group entries by date and pair clock-in/out entries
    const entriesByDate = {};
    entries.forEach(entry => {
      const date = entry.date || entry.timestamp.split('T')[0];
      if (!entriesByDate[date]) {
        entriesByDate[date] = [];
      }
      entriesByDate[date].push(entry);
    });

    const sortedDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(date => {
      const dayEntries = entriesByDate[date].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Group clock-in and clock-out pairs
      const pairs = [];
      let i = 0;

      while (i < dayEntries.length) {
        const entry = dayEntries[i];

        if (entry.type === 'clock_in') {
          // Look for the next clock_out entry
          let clockOutEntry = null;
          let j = i + 1;

          while (j < dayEntries.length) {
            if (dayEntries[j].type === 'clock_out') {
              clockOutEntry = dayEntries[j];
              break;
            }
            j++;
          }

          // Only show clock_in entries that have a corresponding clock_out
          if (clockOutEntry) {
            pairs.push({ clockIn: entry, clockOut: clockOutEntry });
            i = j + 1;
          } else {
            // Incomplete clock_in without clock_out - skip it unless it's the most recent entry
            const isCurrentlyWorking = i === dayEntries.length - 1 && entry.date === formatDate(new Date());
            if (isCurrentlyWorking) {
              pairs.push({ clockIn: entry, clockOut: null });
            }
            i++;
          }
        } else if (entry.type === 'clock_out') {
          // Orphaned clock_out without prior clock_in - only show if it has valid hours
          if (entry.hours && entry.hours > 0) {
            pairs.push({ clockIn: null, clockOut: entry });
          }
          i++;
        } else {
          i++;
        }
      }

      return pairs.map((pair, index) => {
        const clockInTime = pair.clockIn ? formatTimeOnly(pair.clockIn.timestamp) : '--:--';
        const clockOutTime = pair.clockOut ? formatTimeOnly(pair.clockOut.timestamp) : '--:--';
        const duration = calculateDuration(pair.clockIn, pair.clockOut);
        const displayDate = formatDateOnly(date);
        const entryId = pair.clockOut ? pair.clockOut.timestamp : pair.clockIn?.timestamp || `${date}-${index}`;

        if (editingEntry && editingEntry.id === entryId) {
          return (
            <div key={entryId} className="time-entry">
              <div className="time-edit-form">
                <div className="time-inputs">
                  <label>Clock In:</label>
                  <input
                    type="time"
                    className="time-input"
                    value={convertTo24Hour(clockInTime)}
                    onChange={(e) => setEditingEntry({
                      ...editingEntry,
                      clockInTime: e.target.value ? new Date(`${date}T${e.target.value}:00.000Z`).toISOString() : ''
                    })}
                  />
                  <label>Clock Out:</label>
                  <input
                    type="time"
                    className="time-input"
                    value={convertTo24Hour(clockOutTime)}
                    onChange={(e) => setEditingEntry({
                      ...editingEntry,
                      clockOutTime: e.target.value ? new Date(`${date}T${e.target.value}:00.000Z`).toISOString() : ''
                    })}
                  />
                </div>
                <div className="edit-buttons">
                  <button className="save-time-btn" onClick={saveEdit}>Save</button>
                  <button className="cancel-time-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={entryId} className="time-entry">
            <div className="entry-info">
              <div className="entry-status"></div>
              <div className="entry-details">
                <div className="entry-date">{displayDate}</div>
                <div className="entry-times">In: {clockInTime} | Out: {clockOutTime}</div>
              </div>
            </div>
            <div className="entry-duration">
              <span className="duration-display">{duration}</span>
              <div className="entry-actions">
                <button 
                  className="edit-hours-btn" 
                  onClick={() => startEditEntry({ id: entryId, clockIn: pair.clockIn, clockOut: pair.clockOut })} 
                  title="Edit times"
                >
                  ✎
                </button>
                <button 
                  className="delete-entry-btn" 
                  onClick={() => deleteTimeEntry(entryId)} 
                  title="Delete entry"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        );
      });
    });
  };

  return (
    <div className="card time-entries-card">
      <div className="time-entries-header">
        <h2>Time Entries</h2>
        <input 
          type="date" 
          className="date-input" 
          value={selectedDate}
          onChange={handleDateChange}
          title="Select date to view entries"
        />
      </div>

      <div id="timeEntriesContainer">
        {loading && <div className="loading-entries">Loading time entries...</div>}
        {!loading && timeEntries.length === 0 && <div className="no-entries">No time entries found for selected date</div>}
        {!loading && renderTimeEntries()}
      </div>
    </div>
  );
};

export default TimeEntriesCard;