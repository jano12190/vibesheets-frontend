let clockStatus = 'out';
let currentUser = null;
let periodSelectInitialized = false;

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
        loadHours() // Load today's hours by default
        // loadTimeEntries() - will be called by setupDateFilter
    ]);
    
    // Set default hours period to today
    const hoursPeriodSelect = document.getElementById('hoursPeriodSelect');
    if (hoursPeriodSelect) {
        hoursPeriodSelect.value = 'today';
    }
    
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
            // Get current hours period selection
            const hoursPeriodSelect = document.getElementById('hoursPeriodSelect');
            const currentPeriod = hoursPeriodSelect ? hoursPeriodSelect.value : 'today';
            
            await Promise.all([
                loadHours(currentPeriod),
                filterBySpecificDate() // Reload current date's entries
            ]);
        } else {
            let errorMessage = 'Failed to clock in. Please try again.';
            try {
                const error = await response.json();
                errorMessage = 'Failed to clock in: ' + (error.error || error.message || 'Unknown error');
            } catch (e) {
                console.warn('Could not parse error response:', e);
                errorMessage = `Failed to clock in: HTTP ${response.status} ${response.statusText}`;
            }
            alert(errorMessage);
        }
    } catch (error) {
        console.error('Clock in error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            alert('Network error: Please check your internet connection and try again.');
        } else {
            alert('Failed to clock in. Please try again.');
        }
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
            // Get current hours period selection
            const hoursPeriodSelect = document.getElementById('hoursPeriodSelect');
            const currentPeriod = hoursPeriodSelect ? hoursPeriodSelect.value : 'today';
            
            await Promise.all([
                loadHours(currentPeriod),
                filterBySpecificDate() // Reload current date's entries
            ]);
        } else {
            let errorMessage = 'Failed to clock out. Please try again.';
            try {
                const error = await response.json();
                errorMessage = 'Failed to clock out: ' + (error.error || error.message || 'Unknown error');
            } catch (e) {
                console.warn('Could not parse error response:', e);
                errorMessage = `Failed to clock out: HTTP ${response.status} ${response.statusText}`;
            }
            alert(errorMessage);
        }
    } catch (error) {
        console.error('Clock out error:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            alert('Network error: Please check your internet connection and try again.');
        } else {
            alert('Failed to clock out. Please try again.');
        }
    }
}

// Load hours for selected period
async function loadHours(period = 'today') {
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
        
        const response = await apiCall(`/timesheets?start_date=${startDate}&end_date=${endDate}`, 'GET');
        
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
            
            document.getElementById('hoursDisplay').textContent = totalHours.toFixed(2) + 'h';
            document.getElementById('hoursLabel').textContent = labelText;
        }
    } catch (error) {
        console.error('Failed to load hours:', error);
        document.getElementById('hoursDisplay').textContent = '0.00h';
        document.getElementById('hoursLabel').textContent = 'Total Hours';
    }
}

// Load time entries (default to today's date)
async function loadTimeEntries() {
    try {
        // Default to today's entries only
        const today = new Date();
        const todayStr = formatDate(today);
        
        const response = await apiCall(`/timesheets?start_date=${todayStr}&end_date=${todayStr}`, 'GET');
        
        if (response.ok) {
            const data = await response.json();
            console.log('=== API RESPONSE FOR TIME ENTRIES ===');
            console.log('Full response:', data);
            
            // Handle both possible response formats
            const entries = data.entries || data.timesheets || [];
            console.log('Entries to display:', entries);
            
            displayTimeEntries(entries);
            
            // Set the date filter to today's date by default
            const dateFilter = document.getElementById('dateFilter');
            if (dateFilter) {
                dateFilter.value = todayStr;
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
    const dateFilter = document.getElementById('dateFilter');
    const selectedDate = dateFilter ? dateFilter.value : formatDate(new Date());
    
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
    
    // Filter entries to only show the selected date
    if (selectedDate) {
        entries = entries.filter(entry => {
            const entryDate = entry.date || entry.timestamp.split('T')[0];
            return entryDate === selectedDate;
        });
    }
    
    if (!entries.length) {
        container.innerHTML = `<div class="no-entries">No time entries found for ${selectedDate ? formatDateOnly(selectedDate) : 'selected date'}</div>`;
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
        
        // Create pairs by matching clock-out entries with their stored clock_in_time
        const pairs = [];
        const clockInEntries = dayEntries.filter(e => e.type === 'clock_in');
        const clockOutEntries = dayEntries.filter(e => e.type === 'clock_out');
        const usedClockIns = new Set();
        
        // Process clock-out entries first (they have the stored clock_in_time reference)
        clockOutEntries.forEach(clockOut => {
            let matchedClockIn = null;
            
            if (clockOut.clock_in_time) {
                // Find the exact clock-in entry that matches the stored clock_in_time
                matchedClockIn = clockInEntries.find(clockIn => 
                    clockIn.timestamp === clockOut.clock_in_time && !usedClockIns.has(clockIn.timestamp)
                );
            }
            
            if (matchedClockIn) {
                usedClockIns.add(matchedClockIn.timestamp);
                pairs.push({ clockIn: matchedClockIn, clockOut: clockOut });
            } else {
                // This shouldn't happen, but if clock_in_time doesn't match any actual clock-in, skip it
                console.warn('Clock-out entry has no matching clock-in:', clockOut);
            }
        });
        
        // Only show active clock-in if user is currently clocked in
        if (clockStatus === 'in') {
            const today = formatDate(new Date());
            const unusedClockIns = clockInEntries.filter(e => !usedClockIns.has(e.timestamp) && e.date === today);
            if (unusedClockIns.length > 0) {
                const mostRecentClockIn = unusedClockIns.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )[0];
                pairs.push({ clockIn: mostRecentClockIn, clockOut: null });
            }
        }
        
        // Sort pairs by clock-out time (most recent first), then by clock-in time
        pairs.sort((a, b) => {
            const timeA = a.clockOut ? new Date(a.clockOut.timestamp) : (a.clockIn ? new Date(a.clockIn.timestamp) : new Date(0));
            const timeB = b.clockOut ? new Date(b.clockOut.timestamp) : (b.clockIn ? new Date(b.clockIn.timestamp) : new Date(0));
            return timeB.getTime() - timeA.getTime(); // Most recent first
        });
        
        // Generate HTML for each pair
        pairs.forEach((pair, index) => {
            console.log('=== PROCESSING PAIR FOR DISPLAY ===');
            console.log('Pair:', pair);
            console.log('Clock-in timestamp:', pair.clockIn?.timestamp);
            console.log('Clock-out timestamp:', pair.clockOut?.timestamp);
            
            const clockInTime = pair.clockIn ? formatTimeOnly(pair.clockIn.timestamp) : '--:--';
            const clockOutTime = pair.clockOut ? formatTimeOnly(pair.clockOut.timestamp) : '--:--';
            
            console.log('Formatted clock-in time:', clockInTime);
            console.log('Formatted clock-out time:', clockOutTime);
            
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
                        <div class="entry-actions">
                            <button class="edit-hours-btn" onclick="editHours(this)" title="Edit times">✎</button>
                            <button class="delete-entry-btn" onclick="deleteTimeEntry('${entryId}')" title="Delete entry">🗑</button>
                        </div>
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
    if (!select) return;
    
    const optgroup = select.querySelector('optgroup[label="Available Months"]');
    
    // Always clear existing options to prevent duplicates
    if (optgroup) {
        optgroup.innerHTML = '';
    } else {
        console.error('Available Months optgroup not found');
        return;
    }
    
    // Check if we're already building this to prevent race conditions
    if (select.dataset.building === 'true') {
        return;
    }
    select.dataset.building = 'true';
    
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
                const seenMonths = new Set(); // Track months to prevent duplicates
                
                while (currentMonth < endDate) {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
                    
                    // Only add if we haven't seen this month before
                    if (!seenMonths.has(monthKey)) {
                        seenMonths.add(monthKey);
                        const option = document.createElement('option');
                        option.value = monthKey;
                        option.textContent = `${months[month]} ${year}`;
                        optgroup.appendChild(option);
                    }
                    
                    // Move to next month
                    currentMonth.setMonth(currentMonth.getMonth() + 1);
                }
            } else {
                // Fallback: show only current month if no entries exist
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
                const option = document.createElement('option');
                option.value = monthKey;
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
        
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = `${months[currentMonth]} ${currentYear}`;
        optgroup.appendChild(option);
    } finally {
        // Always reset the building flag
        select.dataset.building = 'false';
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

// Handle hours period change
function handleHoursPeriodChange() {
    const select = document.getElementById('hoursPeriodSelect');
    if (select && select.value) {
        loadHours(select.value);
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
        // Show loading state
        const exportBtn = document.querySelector('.export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Exporting...';
        exportBtn.disabled = true;
        
        const response = await apiCall('/export', 'POST', {
            start_date: startDate,
            end_date: endDate,
            format: 'csv'
        });
        
        // Reset button state
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
        
        if (response.ok) {
            // Check content type
            const contentType = response.headers.get('content-type');
            
            if (contentType && (contentType.includes('text/csv') || contentType.includes('application/csv'))) {
                // Handle direct CSV response
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `timesheet_${startDate}_to_${endDate}.csv`;
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
                        // Not JSON, treat as CSV
                        const blob = new Blob([text], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `timesheet_${startDate}_to_${endDate}.csv`;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        
                        setTimeout(() => {
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                        }, 100);
                        return;
                    }
                    
                    // Check if it's CSV data in body
                    if (jsonResponse.body && typeof jsonResponse.body === 'string') {
                        try {
                            // Create CSV blob directly from text
                            const blob = new Blob([jsonResponse.body], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `timesheet_${startDate}_to_${endDate}.csv`;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            
                            setTimeout(() => {
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                            }, 100);
                        } catch (csvError) {
                            console.error('Failed to process CSV:', csvError);
                            alert('Failed to download CSV. The file may be corrupted.');
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
        
        // Reset button state on error
        const exportBtn = document.querySelector('.export-btn');
        if (exportBtn) {
            exportBtn.textContent = 'Export Timesheet';
            exportBtn.disabled = false;
        }
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
    
    // Load today's entries by default
    filterBySpecificDate(formatDate(new Date()));
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

// API call helper function with security enhancements
async function apiCall(endpoint, method, body) {
    // Security checks
    if (window.securityManager) {
        // Check rate limiting
        if (window.securityManager.isRateLimited(endpoint)) {
            throw new Error('Too many requests. Please wait before trying again.');
        }
        
        // Validate input data
        if (body && window.securityManager.detectSuspiciousActivity(method + ' ' + endpoint, body)) {
            throw new Error('Invalid request data detected.');
        }
    }
    
    const token = getAccessToken();
    if (!token) {
        alert('Session expired. Please log in again.');
        window.location.href = '/';
        throw new Error('No access token available');
    }
    
    // Validate JWT format
    if (window.securityManager && !window.securityManager.validateJWTFormat(token)) {
        console.error('Invalid token format detected');
        alert('Invalid session. Please log in again.');
        logout();
        throw new Error('Invalid token format');
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
    
    console.log(`API Call: ${method} ${endpoint}`, body ? '[BODY_REDACTED]' : 'no body');
    
    // Track request timing for monitoring
    const startTime = performance.now();
    
    try {
        const response = await fetch(`https://api.vibesheets.com${endpoint}`, options);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`API Response: ${response.status} ${response.statusText} (${duration.toFixed(2)}ms)`);
        
        // Log API call with logger
        if (window.logger) {
            window.logger.trackAPICall(endpoint, method, duration, response.status);
        }
        
        // Log slow requests
        if (duration > 5000) {
            console.warn(`Slow API request detected: ${endpoint} took ${duration.toFixed(2)}ms`);
            if (window.logger) {
                window.logger.warn('Slow API Request', {
                    endpoint,
                    method,
                    duration,
                    status: response.status
                });
            }
        }
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
            console.error('Authentication failed - token likely expired');
            
            // Log security event
            if (window.securityManager) {
                window.securityManager.logSecurityEvent('auth_failure', {
                    endpoint,
                    status: response.status,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Log with logger
            if (window.logger) {
                window.logger.error('Authentication Failed', {
                    endpoint,
                    method,
                    status: response.status,
                    duration
                });
            }
            
            alert('Your session has expired. Please log in again.');
            logout();
            throw new Error('Authentication failed');
        }
        
        // Handle server errors
        if (response.status >= 500) {
            const errorMsg = `Server error: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            
            if (window.logger) {
                window.logger.error('Server Error', {
                    endpoint,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    duration
                });
            }
            
            throw new Error('Server error. Please try again later.');
        }
        
        return response;
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`API Error: ${error.message} (${duration.toFixed(2)}ms)`);
        
        // Log network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (window.securityManager) {
                window.securityManager.logSecurityEvent('network_error', {
                    endpoint,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        throw error;
    }
}

// Utility functions
function formatDate(date) {
    // Use local timezone to avoid date shifting issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateToUTC(date) {
    // Convert local date to UTC for API calls
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
    // Ensure we're working with a valid date
    if (isNaN(date.getTime())) {
        return '--:--';
    }
    
    // Format time in user's local timezone
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateOnly(dateString) {
    const date = new Date(dateString + 'T12:00:00'); // Add time to prevent timezone issues
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
    
    // Input validation
    if (!clockInTime && !clockOutTime) {
        alert('Please enter at least one time.');
        return;
    }
    
    // Validate time formats using security manager
    if (window.securityManager) {
        if (clockInTime && !window.securityManager.validateTime(clockInTime)) {
            alert('Invalid clock in time format. Please use HH:MM format.');
            return;
        }
        
        if (clockOutTime && !window.securityManager.validateTime(clockOutTime)) {
            alert('Invalid clock out time format. Please use HH:MM format.');
            return;
        }
    }
    
    // Validate logical time order
    if (clockInTime && clockOutTime) {
        const clockInDate = new Date(`2000-01-01T${clockInTime}:00`);
        const clockOutDate = new Date(`2000-01-01T${clockOutTime}:00`);
        
        if (clockInDate >= clockOutDate) {
            alert('Clock out time must be after clock in time.');
            return;
        }
        
        // Check for reasonable work duration (max 24 hours)
        const diffHours = (clockOutDate - clockInDate) / (1000 * 60 * 60);
        if (diffHours > 24) {
            alert('Work duration cannot exceed 24 hours.');
            return;
        }
    }
    
    // Sanitize entry ID
    const sanitizedEntryId = window.securityManager ? 
        window.securityManager.validateText(entryId, 100) : entryId;
    
    if (!sanitizedEntryId) {
        alert('Invalid entry ID.');
        return;
    }
    
    // Convert times to timestamps for the current date
    const entryDiv = document.querySelector(`[data-entry-id="${sanitizedEntryId}"]`);
    if (!entryDiv) {
        alert('Entry not found.');
        return;
    }
    
    const dateText = entryDiv.querySelector('.entry-date').textContent;
    
    // Save to backend
    updateTimeEntryTimes(sanitizedEntryId, clockInTime, clockOutTime, dateText);
    
    // Clean up edit form
    cancelTimeEdit();
}

function cancelTimeEdit() {
    const editForm = document.querySelector('.time-edit-form');
    if (editForm) {
        const entryTimesDiv = editForm.previousSibling;
        const editButton = editForm.parentNode.querySelector('.edit-hours-btn');
        
        if (entryTimesDiv) {
            entryTimesDiv.style.display = 'block';
        }
        if (editButton) {
            editButton.style.display = 'inline-block';
        }
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
        
        // Calculate new hours if both times are provided
        let hours = 0;
        if (clockInTimestamp && clockOutTimestamp) {
            const diffMs = new Date(clockOutTimestamp).getTime() - new Date(clockInTimestamp).getTime();
            hours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
        }
        
        const response = await apiCall('/timesheets', 'PUT', {
            timestamp: entryId,
            hours: hours,
            clock_in_timestamp: clockInTimestamp,
            clock_out_timestamp: clockOutTimestamp
        });
        
        if (response.ok) {
            // Refresh data after successful update
            // Get current hours period selection
            const hoursPeriodSelect = document.getElementById('hoursPeriodSelect');
            const currentPeriod = hoursPeriodSelect ? hoursPeriodSelect.value : 'today';
            
            await Promise.all([
                loadHours(currentPeriod),
                filterBySpecificDate() // Reload current date's entries
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
            // Create date at noon to avoid timezone issues
            return new Date(currentYear, month, parseInt(day), 12, 0, 0);
        }
    }
    
    return null;
}

// Delete time entry
async function deleteTimeEntry(entryId) {
    if (!confirm('Are you sure you want to delete this time entry? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await apiCall('/timesheets', 'DELETE', {
            timestamp: entryId
        });
        
        if (response.ok) {
            // Find and remove the specific time entry element
            const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`);
            if (entryElement) {
                entryElement.style.transition = 'opacity 0.3s ease';
                entryElement.style.opacity = '0';
                setTimeout(() => {
                    entryElement.remove();
                    
                    // Check if container is now empty
                    const container = document.getElementById('timeEntriesContainer');
                    const remainingEntries = container.querySelectorAll('.time-entry');
                    if (remainingEntries.length === 0) {
                        container.innerHTML = '<div class="no-entries">No time entries for this date.</div>';
                    }
                }, 300);
            }
            
            // Update hours display without full reload
            const hoursPeriodSelect = document.getElementById('hoursPeriodSelect');
            const currentPeriod = hoursPeriodSelect ? hoursPeriodSelect.value : 'today';
            loadHours(currentPeriod);
        } else {
            let errorMessage = 'Unknown error';
            try {
                const error = await response.json();
                errorMessage = error.message || error.error || `HTTP ${response.status}: ${response.statusText}`;
            } catch (e) {
                const responseText = await response.text();
                errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
            }
            console.error('Delete API error:', { status: response.status, statusText: response.statusText, errorMessage });
            alert('Failed to delete time entry: ' + errorMessage);
        }
    } catch (error) {
        console.error('Error deleting time entry:', error);
        alert('Failed to delete time entry. Please try again.');
    }
}