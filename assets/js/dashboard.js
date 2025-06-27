/**
 * Dashboard Core Functionality for Vibesheets
 * Handles time tracking, data display, and user interactions
 * Requires: login.js to be loaded first
 */

// Global variables
let clockedIn = false;
let clockInTime = null;
let currentTimeInterval = null;

/**
 * Initialize the dashboard
 */
async function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    try {
        // Initialize authentication first - using vibesheets module
        await window.vibesheets.initialize();
        
        // Start the clock
        updateCurrentTime();
        currentTimeInterval = setInterval(updateCurrentTime, 1000);

        // Load dashboard data
        await loadDashboardData();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('Dashboard initialized successfully');
        
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showError('Failed to initialize dashboard: ' + error.message);
    }
}

/**
 * Update current time display
 */
function updateCurrentTime() {
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

    const timeElement = document.getElementById('currentTime');
    const dateElement = document.getElementById('currentDate');
    
    if (timeElement) timeElement.textContent = timeString;
    if (dateElement) dateElement.textContent = dateString;
}

/**
 * Load dashboard data from API
 */
async function loadDashboardData() {
    try {
        // Check clock status
        await checkClockStatus();
        
        // Load monthly hours
        await loadMonthlyHours();
        
        // Load time entries
        await loadTimeEntries();
        
        // Populate period select options
        populatePeriodSelect();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError('Failed to load data: ' + error.message);
    }
}

/**
 * Check if user is currently clocked in
 */
async function checkClockStatus() {
    try {
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(`${apiUrl}/clock-status`);
        
        if (response.ok) {
            const data = await response.json();
            clockedIn = data.clockedIn || false;
            clockInTime = data.clockInTime ? new Date(data.clockInTime) : null;
            
            updateClockButtons();
        }
    } catch (error) {
        console.error('Failed to check clock status:', error);
        // Don't show error for this - just assume not clocked in
        clockedIn = false;
        updateClockButtons();
    }
}

/**
 * Update clock in/out button visibility
 */
function updateClockButtons() {
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    
    if (clockInBtn && clockOutBtn) {
        if (clockedIn) {
            clockInBtn.style.display = 'none';
            clockOutBtn.style.display = 'block';
        } else {
            clockInBtn.style.display = 'block';
            clockOutBtn.style.display = 'none';
        }
    }
}

/**
 * Clock in function
 */
async function clockIn() {
    try {
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(`${apiUrl}/clock-in`, {
            method: 'POST',
            body: JSON.stringify({
                timestamp: new Date().toISOString()
            })
        });

        if (response.ok) {
            clockedIn = true;
            clockInTime = new Date();
            updateClockButtons();
            showSuccess('Successfully clocked in!');
            
            // Refresh data
            await loadDashboardData();
        } else {
            const error = await response.text();
            throw new Error(error);
        }
    } catch (error) {
        console.error('Clock in failed:', error);
        showError('Failed to clock in: ' + error.message);
    }
}

/**
 * Clock out function
 */
async function clockOut() {
    try {
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(`${apiUrl}/clock-out`, {
            method: 'POST',
            body: JSON.stringify({
                timestamp: new Date().toISOString()
            })
        });

        if (response.ok) {
            clockedIn = false;
            clockInTime = null;
            updateClockButtons();
            showSuccess('Successfully clocked out!');
            
            // Refresh data
            await loadDashboardData();
        } else {
            const error = await response.text();
            throw new Error(error);
        }
    } catch (error) {
        console.error('Clock out failed:', error);
        showError('Failed to clock out: ' + error.message);
    }
}

/**
 * Load monthly hours
 */
async function loadMonthlyHours() {
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
        
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(
            `${apiUrl}/hours?year=${year}&month=${month}`
        );

        if (response.ok) {
            const data = await response.json();
            const hours = data.totalHours || 0;
            const monthlyHoursElement = document.getElementById('monthlyHours');
            if (monthlyHoursElement) {
                monthlyHoursElement.textContent = `${hours.toFixed(2)}h`;
            }
        }
    } catch (error) {
        console.error('Failed to load monthly hours:', error);
        const monthlyHoursElement = document.getElementById('monthlyHours');
        if (monthlyHoursElement) {
            monthlyHoursElement.textContent = '0.00h';
        }
    }
}

/**
 * Load time entries
 */
async function loadTimeEntries() {
    try {
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(`${apiUrl}/entries`);
        
        if (response.ok) {
            const entries = await response.json();
            displayTimeEntries(entries);
        } else {
            throw new Error('Failed to load time entries');
        }
    } catch (error) {
        console.error('Failed to load time entries:', error);
        const container = document.getElementById('timeEntriesContainer');
        if (container) {
            container.innerHTML = '<div class="error-message">Failed to load time entries</div>';
        }
    }
}

/**
 * Display time entries
 */
function displayTimeEntries(entries) {
    const container = document.getElementById('timeEntriesContainer');
    if (!container) return;
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<div class="no-entries">No time entries found</div>';
        return;
    }

    const entriesHtml = entries.map(entry => {
        const startTime = new Date(entry.startTime).toLocaleString();
        const endTime = entry.endTime ? new Date(entry.endTime).toLocaleString() : 'In Progress';
        const duration = entry.duration ? `${entry.duration.toFixed(2)}h` : 'N/A';
        
        return `
            <div class="time-entry" data-id="${entry.id}">
                <div class="entry-details">
                    <div class="entry-date">${new Date(entry.startTime).toLocaleDateString()}</div>
                    <div class="entry-times">
                        <span class="start-time">Start: ${startTime}</span>
                        <span class="end-time">End: ${endTime}</span>
                        <span class="duration">Duration: ${duration}</span>
                    </div>
                </div>
                <div class="entry-actions">
                    <button class="edit-btn" onclick="editEntry('${entry.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteEntry('${entry.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = entriesHtml;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Date filter change
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', handleDateFilterChange);
    }

    // Period select change
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', handlePeriodChange);
    }
}

/**
 * Handle date filter change
 */
function handleDateFilterChange() {
    const dateFilter = document.getElementById('dateFilter');
    const specificDateInput = document.getElementById('specificDateInput');
    
    if (!dateFilter) return;
    
    if (specificDateInput) {
        if (dateFilter.value === 'specific-date') {
            specificDateInput.style.display = 'block';
        } else {
            specificDateInput.style.display = 'none';
            filterTimeEntries(dateFilter.value);
        }
    }
}

/**
 * Handle period selection change
 */
function handlePeriodChange() {
    const periodSelect = document.getElementById('periodSelect');
    const dateRangeInputs = document.getElementById('dateRangeInputs');
    
    if (periodSelect && dateRangeInputs) {
        if (periodSelect.value === 'custom') {
            dateRangeInputs.style.display = 'block';
        } else {
            dateRangeInputs.style.display = 'none';
        }
    }
}

/**
 * Filter time entries by date
 */
async function filterTimeEntries(filter) {
    try {
        const apiUrl = getTimesheetApiUrl();
        let url = `${apiUrl}/entries`;
        
        // Add date filters based on selection
        const now = new Date();
        let startDate, endDate;
        
        switch (filter) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'this-week':
                const firstDay = now.getDate() - now.getDay();
                startDate = new Date(now.getFullYear(), now.getMonth(), firstDay);
                endDate = new Date(now.getFullYear(), now.getMonth(), firstDay + 7);
                break;
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            default:
                // All dates - no filter
                break;
        }
        
        if (startDate && endDate) {
            url += `?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
        }
        
        const response = await window.vibesheets.apiCall(url);
        
        if (response.ok) {
            const entries = await response.json();
            displayTimeEntries(entries);
        }
    } catch (error) {
        console.error('Failed to filter time entries:', error);
        showError('Failed to filter entries: ' + error.message);
    }
}

/**
 * Filter by specific date
 */
function filterBySpecificDate() {
    const specificDate = document.getElementById('specificDate');
    if (specificDate && specificDate.value) {
        const date = new Date(specificDate.value);
        const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        filterTimeEntriesByDateRange(startDate, endDate);
    }
}

/**
 * Filter time entries by date range
 */
async function filterTimeEntriesByDateRange(startDate, endDate) {
    try {
        const apiUrl = getTimesheetApiUrl();
        const url = `${apiUrl}/entries?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
        const response = await window.vibesheets.apiCall(url);
        
        if (response.ok) {
            const entries = await response.json();
            displayTimeEntries(entries);
        }
    } catch (error) {
        console.error('Failed to filter time entries by date range:', error);
        showError('Failed to filter entries: ' + error.message);
    }
}

/**
 * Populate period select options
 */
function populatePeriodSelect() {
    const periodSelect = document.getElementById('periodSelect');
    if (!periodSelect) return;
    
    const optgroup = periodSelect.querySelector('optgroup[label="2025 Months"]');
    if (!optgroup) return;
    
    const currentYear = new Date().getFullYear();
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Clear existing options
    optgroup.innerHTML = '';
    
    // Add current year months
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = `${currentYear}-${index + 1}`;
        option.textContent = `${month} ${currentYear}`;
        optgroup.appendChild(option);
    });
}

/**
 * Export timesheet data
 */
async function exportPDF() {
    try {
        const periodSelect = document.getElementById('periodSelect');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        const apiUrl = getTimesheetApiUrl();
        let url = `${apiUrl}/export`;
        let params = new URLSearchParams();
        
        if (periodSelect && periodSelect.value === 'custom') {
            if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
                params.append('start', startDateInput.value);
                params.append('end', endDateInput.value);
            } else {
                showError('Please select both start and end dates for custom range');
                return;
            }
        } else if (periodSelect && periodSelect.value) {
            const [year, month] = periodSelect.value.split('-');
            params.append('year', year);
            params.append('month', month);
        } else {
            showError('Please select a time period to export');
            return;
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await window.vibesheets.apiCall(url);
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `timesheet-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            showSuccess('Timesheet exported successfully!');
        } else {
            throw new Error('Export failed');
        }
    } catch (error) {
        console.error('Export failed:', error);
        showError('Failed to export timesheet: ' + error.message);
    }
}

/**
 * Edit time entry
 */
function editEntry(entryId) {
    // This would open a modal or form to edit the entry
    console.log('Edit entry:', entryId);
    showInfo('Edit functionality coming soon!');
}

/**
 * Delete time entry
 */
async function deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this time entry?')) {
        return;
    }
    
    try {
        const apiUrl = getTimesheetApiUrl();
        const response = await window.vibesheets.apiCall(`${apiUrl}/entries/${entryId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Time entry deleted successfully!');
            await loadTimeEntries(); // Refresh the list
            await loadMonthlyHours(); // Update monthly total
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showError('Failed to delete time entry: ' + error.message);
    }
}

/**
 * Get timesheet API URL from config
 */
function getTimesheetApiUrl() {
    // First try to get from localStorage (set during login)
    const storedUrl = localStorage.getItem('timesheet_api_url');
    if (storedUrl) {
        return storedUrl;
    }
    
    // Fallback to the config from vibesheets module
    return window.vibesheets.CONFIG.TIMESHEET_API_URL;
}

/**
 * Utility functions for showing messages
 */
function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showInfo(message) {
    showMessage(message, 'info');
}

function showMessage(message, type) {
    // Create or get message container
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.style.cssText = `
        padding: 12px 16px;
        margin-bottom: 10px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        background-color: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
    `;
    messageElement.textContent = message;
    
    // Add to container
    messageContainer.appendChild(messageElement);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageContainer.removeChild(messageElement);
                }
            }, 300);
        }
    }, 5000);
}

// Initialize CSS animations if not already present
function initializeStyles() {
    if (!document.getElementById('messageStyles')) {
        const style = document.createElement('style');
        style.id = 'messageStyles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize styles when script loads
initializeStyles();

// Make functions available globally
window.initializeDashboard = initializeDashboard;
window.clockIn = clockIn;
window.clockOut = clockOut;
window.exportPDF = exportPDF;
window.handlePeriodChange = handlePeriodChange;
window.filterBySpecificDate = filterBySpecificDate;
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;