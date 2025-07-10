/**
 * Security utilities for VibeSheets frontend
 * Handles input validation, XSS prevention, and security headers
 */

class SecurityManager {
    constructor() {
        this.maxInputLength = 1000;
        this.allowedTimeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        this.allowedDateFormat = /^\d{4}-\d{2}-\d{2}$/;
        this.allowedEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    }

    /**
     * Sanitize HTML content to prevent XSS
     */
    sanitizeHTML(input) {
        if (typeof input !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Validate time input (HH:MM format)
     */
    validateTime(time) {
        if (!time || typeof time !== 'string') return false;
        return this.allowedTimeFormat.test(time);
    }

    /**
     * Validate date input (YYYY-MM-DD format)
     */
    validateDate(date) {
        if (!date || typeof date !== 'string') return false;
        if (!this.allowedDateFormat.test(date)) return false;
        
        const dateObj = new Date(date);
        return dateObj instanceof Date && !isNaN(dateObj);
    }

    /**
     * Validate and sanitize text input
     */
    validateText(input, maxLength = this.maxInputLength) {
        if (!input || typeof input !== 'string') return '';
        
        // Remove dangerous characters and limit length
        const sanitized = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .substring(0, maxLength);
            
        return this.sanitizeHTML(sanitized);
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        return this.allowedEmailFormat.test(email) && email.length <= 254;
    }

    /**
     * Rate limiting for API calls
     */
    isRateLimited(endpoint) {
        const now = Date.now();
        const key = `rate_limit_${endpoint}`;
        const requests = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Remove requests older than 1 minute
        const validRequests = requests.filter(time => now - time < 60000);
        
        // Allow max 30 requests per minute per endpoint
        if (validRequests.length >= 30) {
            return true;
        }
        
        // Add current request
        validRequests.push(now);
        localStorage.setItem(key, JSON.stringify(validRequests));
        
        return false;
    }

    /**
     * Validate JWT token format (basic check)
     */
    validateJWTFormat(token) {
        if (!token || typeof token !== 'string') return false;
        
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        try {
            // Check if each part is valid base64
            parts.forEach(part => {
                atob(part.replace(/-/g, '+').replace(/_/g, '/'));
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Content Security Policy headers for enhanced security
     */
    getCSPHeaders() {
        return {
            'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.auth0.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "connect-src 'self' https://api.vibesheets.com https://*.auth0.com",
                "img-src 'self' data:",
                "frame-ancestors 'none'",
                "form-action 'self'"
            ].join('; ')
        };
    }

    /**
     * Check for suspicious activity patterns
     */
    detectSuspiciousActivity(action, data) {
        const patterns = {
            rapidRequests: this.checkRapidRequests(),
            invalidData: this.checkInvalidData(data),
            tokenManipulation: this.checkTokenManipulation()
        };

        const suspicious = Object.values(patterns).some(Boolean);
        
        if (suspicious) {
            console.warn('Suspicious activity detected:', patterns);
            this.logSecurityEvent('suspicious_activity', { action, patterns });
        }
        
        return suspicious;
    }

    checkRapidRequests() {
        const requests = JSON.parse(localStorage.getItem('all_requests') || '[]');
        const now = Date.now();
        const recentRequests = requests.filter(time => now - time < 10000); // 10 seconds
        
        return recentRequests.length > 50; // More than 50 requests in 10 seconds
    }

    checkInvalidData(data) {
        if (!data) return false;
        
        const suspicious = [
            '<script',
            'javascript:',
            'eval(',
            'setTimeout(',
            'setInterval(',
            'Function(',
            'document.cookie',
            'localStorage',
            'sessionStorage'
        ];
        
        const dataStr = JSON.stringify(data).toLowerCase();
        return suspicious.some(pattern => dataStr.includes(pattern));
    }

    checkTokenManipulation() {
        const token = localStorage.getItem('access_token');
        const lastKnownToken = localStorage.getItem('last_known_token');
        
        if (!token) return false;
        
        // Check if token was manually modified
        if (lastKnownToken && token !== lastKnownToken) {
            const tokenAge = Date.now() - parseInt(localStorage.getItem('token_set_time') || '0');
            // If token changed within 5 minutes (not from normal refresh)
            return tokenAge < 300000;
        }
        
        return false;
    }

    logSecurityEvent(event, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Store locally for debugging
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.push(logEntry);
        
        // Keep only last 100 logs
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('security_logs', JSON.stringify(logs));
        
        // In production, this would be sent to a security monitoring service
        console.warn('Security event logged:', logEntry);
    }

    /**
     * Initialize security measures
     */
    initialize() {
        // Set up token tracking
        const token = localStorage.getItem('access_token');
        if (token) {
            localStorage.setItem('last_known_token', token);
            localStorage.setItem('token_set_time', Date.now().toString());
        }

        // Add minimal security headers to fetch requests (avoid CORS conflicts)
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            
            // Only add safe headers that don't trigger CORS preflight
            options.headers = {
                ...options.headers,
                'X-Requested-With': 'XMLHttpRequest'
            };
            
            return originalFetch(url, options);
        };

        console.log('Security manager initialized');
    }
}

// Create global security manager instance
window.securityManager = new SecurityManager();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.securityManager.initialize();
    });
} else {
    window.securityManager.initialize();
}