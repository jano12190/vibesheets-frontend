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
    setupPeriodSelect();
    
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
        hour12: false,
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
                            (day.entries ? day.entries.reduce((daySum, entry) => daySum + (entry.hours || 0), 0) : 0);
                        return sum + dayTotal;
                    }, 0);
                } else {
                    // Direct entries format: sum all hours
                    totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
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

// Load time entries
async function loadTimeEntries() {
    try {
        const response = await apiCall('/timesheets', 'GET');
        
        if (response.ok) {
            const data = await response.json();
            // Handle both possible response formats
            const entries = data.entries || data.timesheets || [];
            displayTimeEntries(entries);
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
            if (entry.type === 'in') {
                if (currentPair) {
                    // Previous pair was incomplete, add it anyway
                    pairs.push(currentPair);
                }
                currentPair = { clockIn: entry, clockOut: null };
            } else if (entry.type === 'out') {
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
        pairs.forEach(pair => {
            const clockInTime = pair.clockIn ? formatTimeOnly(pair.clockIn.timestamp) : '--:--';
            const clockOutTime = pair.clockOut ? formatTimeOnly(pair.clockOut.timestamp) : '--:--';
            const duration = calculateDuration(pair.clockIn, pair.clockOut);
            const displayDate = formatDateOnly(date);
            
            entriesHtml += `
                <div class="time-entry">
                    <div class="entry-info">
                        <div class="entry-status"></div>
                        <div class="entry-details">
                            <div class="entry-date">${displayDate}</div>
                            <div class="entry-times">In: ${clockInTime} | Out: ${clockOutTime}</div>
                        </div>
                    </div>
                    <div class="entry-duration">${duration}</div>
                </div>
            `;
        });
    });
    
    container.innerHTML = entriesHtml;
}


// Setup period select options
function setupPeriodSelect() {
    const select = document.getElementById('periodSelect');
    const optgroup = select.querySelector('optgroup[label="Available Months"]');
    
    // Clear existing options to prevent duplicates
    optgroup.innerHTML = '';
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-based
    
    // Only show months from current month onwards for current year
    for (let month = currentMonth; month < 12; month++) {
        const option = document.createElement('option');
        option.value = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        option.textContent = `${months[month]} ${currentYear}`;
        optgroup.appendChild(option);
    }
    
    // Add next year's months if we're near year end
    if (currentMonth >= 10) { // November or December
        const nextYear = currentYear + 1;
        for (let month = 0; month < 12; month++) {
            const option = document.createElement('option');
            option.value = `${nextYear}-${String(month + 1).padStart(2, '0')}`;
            option.textContent = `${months[month]} ${nextYear}`;
            optgroup.appendChild(option);
        }
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
            a.download = `timesheet_${startDate}_to_${endDate}.csv`;
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

// Setup date filter
function setupDateFilter() {
    const dateFilter = document.getElementById('dateFilter');
    const specificDateInput = document.getElementById('specificDateInput');
    
    dateFilter.addEventListener('change', function() {
        if (this.value === 'specific-date') {
            specificDateInput.style.display = 'flex';
        } else {
            specificDateInput.style.display = 'none';
            filterTimeEntries(this.value);
        }
    });
}

// Filter time entries by date
function filterTimeEntries(filter) {
    // This would filter the displayed entries based on the selected filter
    // For now, just reload all entries
    loadTimeEntries();
}

// Filter by specific date
function filterBySpecificDate() {
    const date = document.getElementById('specificDate').value;
    if (date) {
        // Filter entries for specific date
        loadTimeEntries(); // In a real implementation, this would filter by date
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
        hour12: false
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