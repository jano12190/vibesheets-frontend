import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const HoursCard = () => {
  const [totalHours, setTotalHours] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [periodLabel, setPeriodLabel] = useState('Today');

  useEffect(() => {
    loadHours(selectedPeriod);
  }, [selectedPeriod]);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadHours = async (period = 'today') => {
    try {
      let startDate, endDate, labelText;
      const now = new Date();
      
      switch (period) {
        case 'today':
          startDate = endDate = formatDate(now);
          labelText = 'Today';
          break;
        case 'this-week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          startDate = formatDate(startOfWeek);
          endDate = formatDate(endOfWeek);
          labelText = 'This Week';
          break;
        case 'this-month':
        default:
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          startDate = formatDate(startOfMonth);
          endDate = formatDate(endOfMonth);
          labelText = 'This Month';
          break;
      }
      
      const response = await apiService.getTimesheets({
        start_date: startDate,
        end_date: endDate
      });
      
      if (response.ok) {
        const data = await response.json();
        let calculatedHours = 0;
        
        // Calculate total hours from entries
        const entries = data.entries || data.timesheets || [];
        if (Array.isArray(entries)) {
          if (entries.length > 0 && entries[0].entries) {
            // Grouped format: sum hours from all days
            calculatedHours = entries.reduce((sum, day) => {
              const dayTotal = day.totalHours || 
                (day.entries ? day.entries.reduce((daySum, entry) => {
                  return daySum + (entry.type === 'clock_out' ? (entry.hours || 0) : 0);
                }, 0) : 0);
              return sum + dayTotal;
            }, 0);
          } else {
            // Direct entries format: sum hours from clock_out entries only
            calculatedHours = entries.reduce((sum, entry) => {
              return sum + (entry.type === 'clock_out' ? (entry.hours || 0) : 0);
            }, 0);
          }
        }
        
        // Also try using totalHours from API if calculation is 0
        if (calculatedHours === 0 && data.totalHours) {
          calculatedHours = data.totalHours;
        }
        
        setTotalHours(calculatedHours);
        setPeriodLabel(labelText);
      }
    } catch (error) {
      console.error('Failed to load hours:', error);
      setTotalHours(0);
      setPeriodLabel('Total Hours');
    }
  };

  const handlePeriodChange = (event) => {
    setSelectedPeriod(event.target.value);
  };

  return (
    <div className="card this-month-card">
      <h2 id="hoursLabel">{periodLabel}</h2>
      <select 
        className="hours-period-select" 
        value={selectedPeriod}
        onChange={handlePeriodChange}
      >
        <option value="today">Today</option>
        <option value="this-week">This Week</option>
        <option value="this-month">This Month</option>
      </select>
      <div className="hours-display">{totalHours.toFixed(2)}h</div>
    </div>
  );
};

export default HoursCard;