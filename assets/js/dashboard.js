let clockStatus = 'out';
let currentUser = null;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    // Check authentication
    currentUser = getCurrentUser();
    if (!currentUser && !isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Start clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load initial data
    await Promise.all([
        loadClockStatus(),
        loadMonthlyHours(),
        loadTimeEntries()
    ]);
    
    // Setup period select options
    await setupPeriodSelect();
    
    // Setup date filter
    setupDateFilter();
}

// Display user information
function displayUserInfo() {
    const userDisplay = document.getElementById('userDisplay');
    if (currentUser && userDisplay) {
        const displayName = currentUser.name || currentUser.email || 'User';
        userDisplay.textContent = `Hello, ${displayName}`;
    }
}

// Update clock display
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('currentTime').textContent = timeString;
    document.getElementById('currentDate').textContent = dateString;
}

// Load current clock status
async function loadClockStatus() {
    try {
        const response = await apiCall('/status', 'GET');
        if (response.ok) {
            const data = await response.json();
            clockStatus = data.status || 'out';
            updateClockButtons();
        }
    } catch (error) {
        console.error('Failed to load clock status:', error);
    }
}

// Update clock button visibility
function updateClockButtons() {
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    
    if (clockStatus === 'in') {
        clockInBtn.style.display = 'none';
        clockOutBtn.style.display = 'block';
    } else {
        clockInBtn.style.display = 'block';
        clockOutBtn.style.display = 'none';
    }
}

// Clock in function
async function clockIn() {
    try {
        const response = await apiCall('/clock', 'POST', {
            action: 'in'
        });
        
        if (response.ok) {
            clockStatus = 'in';
            updateClockButtons();
            await Promise.all([
                loadMonthlyHours(),
                loadTimeEntries()
            ]);
        } else {
            const error = await response.json();
            alert('Failed to clock in: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Clock in error:', error);
        alert('Failed to clock in. Please try again.');
    }
}

// Clock out function
async function clockOut() {
    try {
        const response = await apiCall('/clock', 'POST', {
            action: 'out'
        });
        
        if (response.ok) {
            clockStatus = 'out';
            updateClockButtons();
            await Promise.all([
                loadMonthlyHours(),
                loadTimeEntries()
            ]);
        } else {
            const error = await response.json();
            alert('Failed to clock out: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Clock out error:', error);
        alert('Failed to clock out. Please try again.');
    }
}

// Load monthly hours
async function loadMonthlyHours() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const response = await apiCall(`/timesheets?start_date=${formatDate(startOfMonth)}&end_date=${formatDate(endOfMonth)}`, 'GET');
        
        if (response.ok) {
            const data = await response.json();
            let totalHours = 0;
            
            // Calculate total hours from entries
            const entries = data.entries || data.timesheets || [];
            if (Array.isArray(entries)) {
                if (entries.length > 0 && entries[0].entries) {
                    // Grouped format: sum hours from all days
                    totalHours = entries.reduce((sum, day) => {
                        const dayTotal = day.totalHours || 
                            (day.entries ? day.entries.reduce((daySum, entry) => {
                                // Only count hours from clock_out entries
                                return daySum + (entry.type === 'clock_out' ? (entry.hours || 0) : 0);
                            }, 0) : 0);
                        return sum + dayTotal;
                    }, 0);
                } else {
                    // Direct entries format: sum hours from clock_out entries only
                    totalHours = entries.reduce((sum, entry) => {
                        return sum + (entry.type === 'clock_out' ? (entry.hours || 0) : 0);
                    }, 0);
                }
            }
            
            // Also try using totalHours from API if calculation is 0
            if (totalHours === 0 && data.totalHours) {
                totalHours = data.totalHours;
            }
            
            document.getElementById('monthlyHours').textContent = totalHours.toFixed(2) + 'h';
        }
    } catch (error) {
        console.error('Failed to load monthly hours:', error);
        document.getElementById('monthlyHours').textContent = '0.00h';
    }
}

// Load time entries (default to today)
async function loadTimeEntries() {
    try {
        // Default to today's entries
        const today = formatDate(new Date());
        const response = await apiCall(`/timesheets?start_date=${today}&end_date=${today}`, 'GET');
        
        if (response.ok) {
            const data = await response.json();
            // Handle both possible response formats
            const entries = data.entries || data.timesheets || [];
            displayTimeEntries(entries);
            
            // Set the date filter to today's date by default
            const dateFilter = document.getElementById('dateFilter');
            if (dateFilter) {
                dateFilter.value = formatDate(new Date());
            }
        }
    } catch (error) {
        console.error('Failed to load time entries:', error);
        document.getElementById('timeEntriesContainer').innerHTML = '<div class="error">Failed to load time entries</div>';
    }
}

// Display time entries  
function displayTimeEntries(data) {
    const container = document.getElementById('timeEntriesContainer');
    
    // Handle both formats: direct entries array or timesheets grouped by date
    let entries = [];
    if (Array.isArray(data)) {
        if (data.length > 0 && data[0].entries) {
            // Grouped format: flatten all entries from all dates
            entries = data.flatMap(day => day.entries || []);
        } else {
            // Direct entries format
            entries = data;
        }
    }
    
    if (!entries.length) {
        container.innerHTML = '<div class="no-entries">No time entries found</div>';
        return;
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
    
    let entriesHtml = '';
    
    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a));
    
    sortedDates.forEach(date => {
        const dayEntries = entriesByDate[date].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Group clock-in and clock-out pairs
        const pairs = [];
        let currentPair = null;
        
        dayEntries.forEach(entry => {
            if (entry.type === 'clock_in') {
                if (currentPair) {
                    // Previous pair was incomplete, add it anyway
                    pairs.push(currentPair);
                }
                currentPair = { clockIn: entry, clockOut: null };
            } else if (entry.type === 'clock_out') {
                if (currentPair) {
                    currentPair.clockOut = entry;
                    pairs.push(currentPair);
                    currentPair = null;
                } else {
                    // Clock out without clock in, show as standalone
                    pairs.push({ clockIn: null, clockOut: entry });
                }
            }
        });
        
        // Add incomplete pair if exists
        if (currentPair) {
            pairs.push(currentPair);
        }
        
        // Generate HTML for each pair
        pairs.forEach((pair, index) => {
            const clockInTime = pair.clockIn ? formatTimeOnly(pair.clockIn.timestamp) : '--:--';
            const clockOutTime = pair.clockOut ? formatTimeOnly(pair.clockOut.timestamp) : '--:--';
            const duration = calculateDuration(pair.clockIn, pair.clockOut);
            const displayDate = formatDateOnly(date);
            const hours = pair.clockOut ? (pair.clockOut.hours || 0) : 0;
            const entryId = pair.clockOut ? pair.clockOut.timestamp : pair.clockIn?.timestamp || `${date}-${index}`;
            
            entriesHtml += `
                <div class="time-entry" data-entry-id="${entryId}">
                    <div class="entry-info">
                        <div class="entry-status"></div>
                        <div class="entry-details">
                            <div class="entry-date">${displayDate}</div>
                            <div class="entry-times">In: ${clockInTime} | Out: ${clockOutTime}</div>
                        </div>
                    </div>
                    <div class="entry-duration">
                        <span class="duration-display">${duration}</span>
                        <button class="edit-hours-btn" onclick="editHours(this)" title="Edit times">✎</button>
                    </div>
                </div>
            `;
        });
    });
    
    container.innerHTML = entriesHtml;
}


// Setup period select options based on user's time entries
async function setupPeriodSelect() {
    const select = document.getElementById('periodSelect');
    const optgroup = select.querySelector('optgroup[label="Available Months"]');
    
    // Clear existing options to prevent duplicates
    optgroup.innerHTML = '';
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    try {
        // Get all user's time entries to find their first month
        const response = await apiCall('/timesheets', 'GET');
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
                // Find the earliest date
                const earliestDate = new Date(Math.min(...allDates.map(d => new Date(d))));
                const latestDate = new Date(Math.max(...allDates.map(d => new Date(d))));
                
                // Generate options from earliest month to current month only (no future months)
                const currentDate = new Date();
                const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1); // Up to current month only
                
                let currentMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
                
                while (currentMonth < endDate) {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    
                    const option = document.createElement('option');
                    option.value = `${year}-${String(month + 1).padStart(2, '0')}`;
                    option.textContent = `${months[month]} ${year}`;
                    optgroup.appendChild(option);
                    
                    // Move to next month
                    currentMonth.setMonth(currentMonth.getMonth() + 1);
                }
            } else {
                // Fallback: show only current month if no entries exist
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                const option = document.createElement('option');
                option.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
                option.textContent = `${months[currentMonth]} ${currentYear}`;
                optgroup.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Failed to setup period select:', error);
        // Fallback to basic setup - only current month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        const option = document.createElement('option');
        option.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        option.textContent = `${months[currentMonth]} ${currentYear}`;
        optgroup.appendChild(option);
    }
}

// Handle period change
function handlePeriodChange() {
    const select = document.getElementById('periodSelect');
    const dateRangeInputs = document.getElementById('dateRangeInputs');
    
    if (select.value === 'custom') {
        dateRangeInputs.style.display = 'flex';
    } else {
        dateRangeInputs.style.display = 'none';
    }
}

// Export PDF/CSV
async function exportPDF() {
    const periodSelect = document.getElementById('periodSelect');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    let startDate, endDate;
    
    if (periodSelect.value === 'custom') {
        if (!startDateInput.value || !endDateInput.value) {
            alert('Please select both start and end dates for custom range.');
            return;
        }
        startDate = startDateInput.value;
        endDate = endDateInput.value;
    } else if (periodSelect.value) {
        // Monthly export
        const [year, month] = periodSelect.value.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
        alert('Please select a time period to export.');
        return;
    }
    
    try {
        const response = await apiCall('/export', 'POST', {
            start_date: startDate,
            end_date: endDate
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timesheet_${startDate}_to_${endDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const error = await response.json();
            alert('Export failed: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed. Please try again.');
    }
}

// Setup date filter with calendar only
function setupDateFilter() {
    const dateFilter = document.getElementById('dateFilter');
    
    // Set default date to today
    const today = new Date();
    dateFilter.value = formatDate(today);
    
    // Handle calendar date change
    dateFilter.addEventListener('change', function() {
        if (this.value) {
            filterBySpecificDate(this.value);
        } else {
            // If no date selected, default to today
            this.value = formatDate(new Date());
            filterBySpecificDate(this.value);
        }
    });
}


// Filter by specific date
async function filterBySpecificDate(date) {
    // If no date parameter passed, get it from the date filter
    if (!date) {
        const dateFilter = document.getElementById('dateFilter');
        date = dateFilter ? dateFilter.value : null;
    }
    
    if (date) {
        try {
            const response = await apiCall(`/timesheets?start_date=${date}&end_date=${date}`, 'GET');
            
            if (response.ok) {
                const data = await response.json();
                const entries = data.entries || data.timesheets || [];
                displayTimeEntries(entries);
            } else {
                console.error('Failed to filter by specific date');
                document.getElementById('timeEntriesContainer').innerHTML = '<div class="error">Failed to load entries for selected date</div>';
            }
        } catch (error) {
            console.error('Error filtering by specific date:', error);
            document.getElementById('timeEntriesContainer').innerHTML = '<div class="error">Error loading entries for selected date</div>';
        }
    } else {
        // If no date selected, show today's entries
        const today = formatDate(new Date());
        filterBySpecificDate(today);
    }
}

// API call helper function
async function apiCall(endpoint, method, body) {
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token available');
    }
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    return fetch(`https://api.vibesheets.com${endpoint}`, options);
}

// Utility functions
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeOnly(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateOnly(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function calculateDuration(clockIn, clockOut) {
    if (!clockIn || !clockOut) {
        return clockIn && !clockOut ? 'In Progress' : '--:--';
    }
    
    const start = new Date(clockIn.timestamp);
    const end = new Date(clockOut.timestamp);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours.toFixed(2) + 'h';
}

// Edit time functionality (clock in/out times instead of hours)
function editHours(button) {
    const entryDiv = button.closest('.time-entry');
    const entryId = entryDiv.dataset.entryId;
    
    // Get current times from the entry
    const entryTimesDiv = entryDiv.querySelector('.entry-times');
    const timesText = entryTimesDiv.textContent;
    
    // Extract clock in and clock out times
    const inMatch = timesText.match(/In: (\d{1,2}:\d{2} [AP]M|--:--)/);  
    const outMatch = timesText.match(/Out: (\d{1,2}:\d{2} [AP]M|--:--)/);;    
    const clockInTime = inMatch ? inMatch[1] : '--:--';
    const clockOutTime = outMatch ? outMatch[1] : '--:--';
    
    // Create edit form
    const editForm = document.createElement('div');
    editForm.className = 'time-edit-form';
    editForm.innerHTML = `
        <div class="time-inputs">
            <label>Clock In:</label>
            <input type="time" class="time-input" id="clockInTime" value="${convertTo24Hour(clockInTime)}">
            <label>Clock Out:</label>
            <input type="time" class="time-input" id="clockOutTime" value="${convertTo24Hour(clockOutTime)}">
        </div>
        <div class="edit-buttons">
            <button class="save-time-btn" onclick="saveTimeEdit('${entryId}')">Save</button>
            <button class="cancel-time-btn" onclick="cancelTimeEdit()">Cancel</button>
        </div>
    `;
    
    // Replace the entry times with edit form
    entryTimesDiv.style.display = 'none';
    entryTimesDiv.parentNode.insertBefore(editForm, entryTimesDiv.nextSibling);
    button.style.display = 'none';
}

function saveTimeEdit(entryId) {
    const editForm = document.querySelector('.time-edit-form');
    const clockInInput = editForm.querySelector('#clockInTime');
    const clockOutInput = editForm.querySelector('#clockOutTime');
    
    const clockInTime = clockInInput.value;
    const clockOutTime = clockOutInput.value;
    
    if (!clockInTime && !clockOutTime) {
        alert('Please enter at least one time.');
        return;
    }
    
    // Convert times to timestamps for the current date
    const entryDiv = document.querySelector(`[data-entry-id="${entryId}"]`);
    const dateText = entryDiv.querySelector('.entry-date').textContent;
    
    // Save to backend
    updateTimeEntryTimes(entryId, clockInTime, clockOutTime, dateText);
    
    // Clean up edit form
    cancelTimeEdit();
}

function cancelTimeEdit() {
    const editForm = document.querySelector('.time-edit-form');
    if (editForm) {
        const entryTimesDiv = editForm.previousSibling;
        const editButton = editForm.parentNode.querySelector('.edit-hours-btn');
        
        entryTimesDiv.style.display = 'block';
        editButton.style.display = 'inline-block';
        editForm.remove();
    }
}

function convertTo24Hour(time12h) {
    if (time12h === '--:--' || !time12h) return '';
    
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
        hours = '00';
    }
    
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function convertTo12Hour(time24h) {
    if (!time24h) return '--:--';
    
    const [hours, minutes] = time24h.split(':');
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    
    return `${hour12}:${minutes} ${ampm}`;
}

async function updateTimeEntryTimes(entryId, clockInTime, clockOutTime, dateText) {
    try {
        // Parse the date from the display text
        const today = new Date();
        const entryDate = parseDisplayDate(dateText) || today;
        
        let clockInTimestamp = null;
        let clockOutTimestamp = null;
        
        if (clockInTime) {
            const [hours, minutes] = clockInTime.split(':');
            const clockInDate = new Date(entryDate);
            clockInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            clockInTimestamp = clockInDate.toISOString();
        }
        
        if (clockOutTime) {
            const [hours, minutes] = clockOutTime.split(':');
            const clockOutDate = new Date(entryDate);
            clockOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            clockOutTimestamp = clockOutDate.toISOString();
        }
        
        const response = await apiCall('/timesheets', 'PUT', {
            timestamp: entryId,
            clock_in_time: clockInTimestamp,
            clock_out_time: clockOutTimestamp
        });
        
        if (response.ok) {
            // Refresh data after successful update
            await Promise.all([
                loadMonthlyHours(),
                loadTimeEntries()
            ]);
        } else {
            const error = await response.json();
            alert('Failed to update times: ' + (error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating times:', error);
        alert('Failed to update times. Please try again.');
    }
}

function parseDisplayDate(dateText) {
    // Parse date from format like "Mon, Jun 3" back to a Date object
    const currentYear = new Date().getFullYear();
    const months = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const parts = dateText.split(', ');
    if (parts.length === 2) {
        const [monthStr, day] = parts[1].split(' ');
        const month = months[monthStr];
        if (month !== undefined) {
            return new Date(currentYear, month, parseInt(day));
        }
    }
    
    return null;
}