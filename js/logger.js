/**
 * Production-ready logging system for VibeSheets
 * Handles error tracking, performance monitoring, and user analytics
 */

class Logger {
    constructor() {
        this.logLevel = this.getLogLevel();
        this.sessionId = this.generateSessionId();
        this.userId = null;
        this.logs = [];
        this.maxLogs = 1000;
        this.flushInterval = 30000; // 30 seconds
        this.errorCount = 0;
        this.performanceMetrics = {};
        
        this.initializeLogger();
    }

    getLogLevel() {
        // Production: 'error', Development: 'debug'
        return window.location.hostname === 'localhost' ? 'debug' : 'error';
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeLogger() {
        // Set up periodic log flushing
        setInterval(() => this.flushLogs(), this.flushInterval);
        
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Unhandled JavaScript Error', {
                message: event.error?.message || event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });

        // Performance observer for monitoring
        if ('PerformanceObserver' in window) {
            this.setupPerformanceMonitoring();
        }

        // Network status monitoring
        this.setupNetworkMonitoring();

        console.log(`Logger initialized - Session: ${this.sessionId}, Level: ${this.logLevel}`);
    }

    setupPerformanceMonitoring() {
        try {
            // Monitor long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        this.warn('Long Task Detected', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });
                    }
                }
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });

            // Monitor navigation timing
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    if (navigation) {
                        this.info('Page Load Performance', {
                            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                            totalTime: navigation.loadEventEnd - navigation.fetchStart
                        });
                    }
                }, 0);
            });
        } catch (error) {
            console.warn('Performance monitoring setup failed:', error);
        }
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.info('Network Status', { status: 'online' });
        });

        window.addEventListener('offline', () => {
            this.warn('Network Status', { status: 'offline' });
        });
    }

    setUser(userId, userInfo = {}) {
        this.userId = userId;
        this.info('User Session Started', {
            userId,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            ...userInfo
        });
    }

    log(level, message, data = {}, tags = []) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            tags,
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Store locally
        this.logs.push(logEntry);
        
        // Trim logs if too many
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output based on log level
        if (this.shouldLog(level)) {
            const consoleMethod = this.getConsoleMethod(level);
            consoleMethod(`[${level.toUpperCase()}] ${message}`, data);
        }

        // Count errors for health monitoring
        if (level === 'error') {
            this.errorCount++;
        }

        // Auto-flush critical errors
        if (level === 'error' || level === 'fatal') {
            this.flushLogs();
        }
    }

    shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
        const currentLevel = levels[this.logLevel] || 2;
        const messageLevel = levels[level] || 0;
        return messageLevel >= currentLevel;
    }

    getConsoleMethod(level) {
        switch (level) {
            case 'debug': return console.debug;
            case 'info': return console.info;
            case 'warn': return console.warn;
            case 'error': return console.error;
            case 'fatal': return console.error;
            default: return console.log;
        }
    }

    debug(message, data = {}, tags = []) {
        this.log('debug', message, data, tags);
    }

    info(message, data = {}, tags = []) {
        this.log('info', message, data, tags);
    }

    warn(message, data = {}, tags = []) {
        this.log('warn', message, data, tags);
    }

    error(message, data = {}, tags = []) {
        this.log('error', message, data, tags);
    }

    fatal(message, data = {}, tags = []) {
        this.log('fatal', message, data, tags);
    }

    // Track user actions for analytics
    trackAction(action, data = {}) {
        this.info('User Action', {
            action,
            timestamp: Date.now(),
            ...data
        }, ['analytics']);
    }

    // Track API calls
    trackAPICall(endpoint, method, duration, status, error = null) {
        const data = {
            endpoint,
            method,
            duration,
            status,
            timestamp: Date.now()
        };

        if (error) {
            data.error = error;
            this.error('API Call Failed', data, ['api']);
        } else {
            this.info('API Call', data, ['api']);
        }
    }

    // Track performance metrics
    trackPerformance(metric, value, tags = []) {
        this.performanceMetrics[metric] = value;
        this.info('Performance Metric', {
            metric,
            value,
            timestamp: Date.now()
        }, ['performance', ...tags]);
    }

    // Get system health status
    getHealthStatus() {
        const recentErrors = this.logs
            .filter(log => log.level === 'error' && Date.now() - new Date(log.timestamp).getTime() < 300000) // Last 5 minutes
            .length;

        const memoryUsage = this.getMemoryUsage();
        
        return {
            status: recentErrors > 10 ? 'unhealthy' : 'healthy',
            errorCount: this.errorCount,
            recentErrors,
            memoryUsage,
            sessionId: this.sessionId,
            uptime: Date.now() - new Date(this.logs[0]?.timestamp || Date.now()).getTime()
        };
    }

    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    // Flush logs to server (in production, this would send to a logging service)
    async flushLogs() {
        if (this.logs.length === 0) return;

        const logsToFlush = [...this.logs];
        this.logs = []; // Clear local logs

        try {
            // In production, send to logging service like DataDog, Splunk, etc.
            // For now, store in localStorage for debugging
            const existingLogs = JSON.parse(localStorage.getItem('app_logs') || '[]');
            const allLogs = [...existingLogs, ...logsToFlush];
            
            // Keep only last 500 logs in localStorage
            if (allLogs.length > 500) {
                allLogs.splice(0, allLogs.length - 500);
            }
            
            localStorage.setItem('app_logs', JSON.stringify(allLogs));
            
            console.debug(`Flushed ${logsToFlush.length} logs to storage`);
        } catch (error) {
            console.error('Failed to flush logs:', error);
            // Put logs back if flush failed
            this.logs.unshift(...logsToFlush);
        }
    }

    // Export logs for debugging
    exportLogs() {
        const allLogs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        const logData = JSON.stringify(allLogs, null, 2);
        
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `vibesheets-logs-${this.sessionId}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Clear all logs
    clearLogs() {
        this.logs = [];
        localStorage.removeItem('app_logs');
        this.info('Logs cleared');
    }
}

// Create global logger instance
window.logger = new Logger();

// Set up global error handler that uses our logger
window.onerror = function(message, source, lineno, colno, error) {
    window.logger.error('JavaScript Error', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack
    });
    return false; // Don't prevent default error handling
};

console.log('Logger system initialized');