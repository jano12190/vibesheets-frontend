import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const ExportCard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setupPeriodOptions();
  }, []);

  const setupPeriodOptions = async () => {
    try {
      const response = await apiService.getTimesheets();
      if (response.ok) {
        const data = await response.json();
        const entries = data.entries || data.timesheets || [];
        
        let allDates = [];
        if (Array.isArray(entries)) {
          if (entries.length > 0 && entries[0].entries) {
            // Grouped format: extract dates from all day groups
            allDates = entries.map(day => day.date).filter(Boolean);
          } else {
            // Direct entries format: extract dates from timestamps
            allDates = entries.map(entry => {
              const date = entry.date || entry.timestamp.split('T')[0];
              return date;
            }).filter(Boolean);
          }
        }
        
        if (allDates.length > 0) {
          // Find the earliest and latest dates
          const earliestDate = new Date(Math.min(...allDates.map(d => new Date(d))));
          const currentDate = new Date();
          
          // Generate month options from earliest month to current month
          const months = [];
          let currentMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
          
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          
          while (currentMonth < endDate) {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            
            months.push({
              value: `${year}-${String(month + 1).padStart(2, '0')}`,
              label: `${monthNames[month]} ${year}`
            });
            
            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
          
          setAvailableMonths(months);
        } else {
          // Fallback: show only current month if no entries exist
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          
          setAvailableMonths([{
            value: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
            label: `${monthNames[currentMonth]} ${currentYear}`
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to setup period options:', error);
    }
  };

  const handlePeriodChange = (event) => {
    const value = event.target.value;
    setSelectedPeriod(value);
    setShowDateRange(value === 'custom');
  };

  const exportPDF = async () => {
    if (!selectedPeriod) {
      alert('Please select a time period to export.');
      return;
    }

    let exportStartDate, exportEndDate;
    
    if (selectedPeriod === 'custom') {
      if (!startDate || !endDate) {
        alert('Please select both start and end dates for custom range.');
        return;
      }
      exportStartDate = startDate;
      exportEndDate = endDate;
    } else {
      // Monthly export
      const [year, month] = selectedPeriod.split('-');
      exportStartDate = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      exportEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
    
    try {
      setExporting(true);
      
      const response = await apiService.exportTimesheet({
        start_date: exportStartDate,
        end_date: exportEndDate,
        format: 'pdf'
      });
      
      if (response.ok) {
        // Check content type
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/pdf')) {
          // Handle direct PDF response
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `timesheet_${exportStartDate}_to_${exportEndDate}.pdf`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 100);
        } else {
          // Try to parse as JSON first (common response from API Gateway)
          try {
            const text = await response.text();
            let jsonResponse;
            
            try {
              jsonResponse = JSON.parse(text);
            } catch (jsonError) {
              // Not JSON, treat as binary
              const blob = new Blob([text], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `timesheet_${exportStartDate}_to_${exportEndDate}.pdf`;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              
              setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }, 100);
              return;
            }
            
            // Check if it's a base64 encoded PDF in body
            if (jsonResponse.body && typeof jsonResponse.body === 'string') {
              try {
                // Decode base64 and create blob
                const binaryString = atob(jsonResponse.body);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `timesheet_${exportStartDate}_to_${exportEndDate}.pdf`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                }, 100);
              } catch (base64Error) {
                console.error('Failed to decode base64 PDF:', base64Error);
                alert('Failed to download PDF. The file may be corrupted.');
              }
            } else {
              // Regular JSON response, not a file
              alert('Received unexpected response format from server.');
            }
          } catch (textError) {
            console.error('Failed to process response:', textError);
            alert('Failed to process server response.');
          }
        }
      } else {
        const error = await response.json();
        alert('Export failed: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card export-card">
      <h2>Export Timesheet</h2>
      <div className="export-controls">
        <label htmlFor="periodSelect">Period:</label>
        <select 
          className="period-select" 
          id="periodSelect" 
          value={selectedPeriod}
          onChange={handlePeriodChange}
        >
          <option value="">Select time period</option>
          <optgroup label="Available Months">
            {availableMonths.map(month => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Custom">
            <option value="custom">Custom Date Range...</option>
          </optgroup>
        </select>
        <button 
          className="export-btn" 
          onClick={exportPDF}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>
      
      {showDateRange && (
        <div className="date-range-inputs">
          <label>From:</label>
          <input 
            type="date" 
            className="date-input" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label>To:</label>
          <input 
            type="date" 
            className="date-input" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default ExportCard;