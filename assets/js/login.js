/**
 * Combined Authentication & UI Module for Vibesheets
 * Handles Auth0 and Google OAuth authentication with UI management
 */

window.vibesheets = (function() {
    'use strict';
    
    // Auth module state
    let auth0Instance = null;
    let authConfigData = null;
    let isInitialized = false;
    let isInitializing = false;
    
    // Configuration
    const CONFIG = {
        // Auto-detect API Gateway URL based on current domain
        AUTH_API_URL: null, // Will be set automatically
        
        // Replace with your timesheet API base URL
        TIMESHEET_API_URL: 'https://3r0khwlvdl.execute-api.us-east-1.amazonaws.com/dev',
        
        // Auth configuration - will be set dynamically
        REDIRECT_URI: null,
        LOGOUT_URI: null
    };
    
    // Auto-detect configuration from current domain
    function initializeConfig() {
        // Set redirect URIs based on current location
        CONFIG.REDIRECT_URI = window.location.origin + '/dashboard.html';
        CONFIG.LOGOUT_URI = window.location.origin + '/';
        
        if (!CONFIG.AUTH_API_URL) {
            // Try to detect from localStorage first (for development)
            const storedUrl = localStorage.getItem('auth_api_url');
            if (storedUrl) {
                CONFIG.AUTH_API_URL = storedUrl;
                console.log('Using stored auth API URL:', CONFIG.AUTH_API_URL);
                return true;
            }
            
            // Auto-detect based on current domain
            const currentDomain = window.location.hostname;
            
            if (currentDomain === 'localhost' || currentDomain === '127.0.0.1') {
                // Development mode - allow manual configuration
                console.warn('Development mode detected. Set AUTH_API_URL in localStorage with key "auth_api_url"');
                
                // Try common development patterns
                const devUrls = [
                    'http://localhost:3000/dev/config',
                    'http://localhost:8000/config',
                    'https://tizdl2ywqi.execute-api.us-east-1.amazonaws.com/dev/config'
                ];
                
                // For now, use the AWS endpoint as fallback
                CONFIG.AUTH_API_URL = 'https://tizdl2ywqi.execute-api.us-east-1.amazonaws.com/dev/config';
                localStorage.setItem('auth_api_url', CONFIG.AUTH_API_URL);
                console.log('Using fallback auth API URL:', CONFIG.AUTH_API_URL);
                
                return true;
            } else {
                // Production mode - construct API URL based on your terraform setup
                // Update this to match your actual API Gateway configuration
                CONFIG.AUTH_API_URL = `https://tizdl2ywqi.execute-api.us-east-1.amazonaws.com/prod/config`;
                localStorage.setItem('auth_api_url', CONFIG.AUTH_API_URL);
                console.log('Auto-detected auth API URL:', CONFIG.AUTH_API_URL);
                return true;
            }
        }
        
        return CONFIG.AUTH_API_URL !== null;
    }
    
    /**
     * Load authentication configuration from AWS Lambda
     */
    async function loadAuthConfig() {
        if (!CONFIG.AUTH_API_URL) {
            throw new Error('AUTH_API_URL not configured');
        }
        
        try {
            console.log('Loading auth config from:', CONFIG.AUTH_API_URL);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(CONFIG.AUTH_API_URL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`);
            }
            
            const data = await response.json();
            
            // Validate required fields
            const requiredFields = ['auth0_domain', 'auth0_client_id'];
            const missingFields = requiredFields.filter(field => 
                !data[field] || 
                data[field].startsWith('placeholder') || 
                data[field] === 'your-auth0-domain' ||
                data[field] === 'your-client-id'
            );
            
            if (missingFields.length > 0) {
                throw new Error(`Missing or incomplete configuration fields: ${missingFields.join(', ')}`);
            }
            
            authConfigData = data;
            console.log('Auth config loaded successfully');
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Authentication configuration request timed out');
            }
            console.error('Failed to load auth config:', error);
            throw new Error(`Authentication configuration failed: ${error.message}`);
        }
    }
    
    /**
     * Initialize Auth0 client
     */
    function initializeAuth0() {
        if (!authConfigData) {
            throw new Error('Auth configuration not loaded');
        }
        
        try {
            const auth0Config = {
                domain: authConfigData.auth0_domain,
                clientID: authConfigData.auth0_client_id,
                redirectUri: CONFIG.REDIRECT_URI,
                responseType: 'token id_token',
                scope: 'openid profile email'
            };
            
            // Add audience if provided (for API access)
            if (authConfigData.auth0_audience && 
                authConfigData.auth0_audience !== 'placeholder-audience' &&
                authConfigData.auth0_audience !== 'your-api-audience') {
                auth0Config.audience = authConfigData.auth0_audience;
            }
            
            auth0Instance = new auth0.WebAuth(auth0Config);
            
            console.log('Auth0 client initialized with domain:', authConfigData.auth0_domain);
            return auth0Instance;
            
        } catch (error) {
            console.error('Failed to initialize Auth0:', error);
            throw new Error(`Auth0 initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Initialize Google OAuth (optional)
     */
    function initializeGoogleAuth() {
        return new Promise((resolve, reject) => {
            // Skip Google auth if no client ID is provided
            if (!authConfigData.google_client_id || 
                authConfigData.google_client_id.startsWith('placeholder') ||
                authConfigData.google_client_id === 'your-google-client-id') {
                console.log('Google client ID not configured, skipping Google auth');
                resolve();
                return;
            }
            
            // Load Google API if not already loaded
            if (typeof gapi === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api:client.js';
                script.onload = () => {
                    gapi.load('auth2', () => {
                        gapi.auth2.init({
                            client_id: authConfigData.google_client_id
                        }).then(() => {
                            console.log('Google Auth initialized');
                            resolve();
                        }).catch(error => {
                            console.warn('Google Auth initialization failed:', error);
                            resolve(); // Don't fail completely for Google auth issues
                        });
                    });
                };
                script.onerror = () => {
                    console.warn('Failed to load Google API');
                    resolve(); // Don't fail completely
                };
                document.head.appendChild(script);
            } else {
                gapi.load('auth2', () => {
                    gapi.auth2.init({
                        client_id: authConfigData.google_client_id
                    }).then(() => {
                        console.log('Google Auth initialized');
                        resolve();
                    }).catch(error => {
                        console.warn('Google Auth initialization failed:', error);
                        resolve(); // Don't fail completely
                    });
                });
            }
        });
    }
    
    /**
     * Main initialization function
     */
    async function initialize() {
        if (isInitializing) {
            // Wait for existing initialization to complete
            while (isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return authConfigData;
        }
        
        if (isInitialized) return authConfigData;
        
        isInitializing = true;
        
        try {
            showLoading(true);
            
            // Initialize configuration
            if (!initializeConfig()) {
                throw new Error('Configuration initialization failed');
            }
            
            // Load configuration from API
            await loadAuthConfig();
            
            // Initialize Auth0 (required)
            initializeAuth0();
            
            // Initialize Google Auth (optional)
            try {
                await initializeGoogleAuth();
            } catch (error) {
                console.warn('Google Auth initialization failed (continuing without Google login):', error);
            }
            
            isInitialized = true;
            showLoading(false);
            enableButtons(true);
            
            return authConfigData;
            
        } catch (error) {
            console.error('Authentication initialization failed:', error);
            showError(`Failed to initialize authentication: ${error.message}`);
            showLoading(false);
            enableButtons(false);
            throw error;
        } finally {
            isInitializing = false;
        }
    }
    
    /**
     * Login with Auth0 (email/password)
     */
    async function login() {
        if (!auth0Instance) {
            await initialize();
        }
        
        if (!auth0Instance) {
            throw new Error('Auth0 not initialized');
        }
        
        try {
            showLoading(true);
            showError(''); // Clear any previous errors
            
            auth0Instance.authorize({
                connection: 'Username-Password-Authentication'
            });
        } catch (error) {
            console.error('Login error:', error);
            showError('Login failed: ' + error.message);
            showLoading(false);
            throw error;
        }
    }
    
    /**
     * Signup with Auth0
     */
    async function signup() {
        if (!auth0Instance) {
            await initialize();
        }
        
        if (!auth0Instance) {
            throw new Error('Auth0 not initialized');
        }
        
        try {
            showLoading(true);
            showError(''); // Clear any previous errors
            
            auth0Instance.authorize({
                connection: 'Username-Password-Authentication',
                mode: 'signUp'
            });
        } catch (error) {
            console.error('Signup error:', error);
            showError('Signup failed: ' + error.message);
            showLoading(false);
            throw error;
        }
    }
    
    /**
     * Login with Google OAuth
     */
    async function loginWithGoogle() {
        try {
            showLoading(true);
            showError(''); // Clear any previous errors
            
            // Check if Google auth is available
            if (typeof gapi === 'undefined' || !gapi.auth2) {
                throw new Error('Google authentication is not available');
            }
            
            const authInstance = gapi.auth2.getAuthInstance();
            if (!authInstance) {
                throw new Error('Google Auth not properly initialized');
            }
            
            const result = await authInstance.signIn();
            const idToken = result.getAuthResponse().id_token;
            
            // Use the Google token with Auth0's social connection
            if (!auth0Instance) {
                await initialize();
            }
            
            auth0Instance.authorize({
                connection: 'google-oauth2'
            });
            
        } catch (error) {
            console.error('Google login failed:', error);
            showError('Google login failed: ' + error.message);
            showLoading(false);
            throw error;
        }
    }
    
    /**
     * Handle authentication callback
     */
    function handleCallback() {
        if (!auth0Instance) {
            console.error('Auth0 not initialized for callback handling');
            showError('Authentication system not ready. Please refresh the page.');
            return Promise.reject(new Error('Auth0 not initialized'));
        }
        
        return new Promise((resolve, reject) => {
            showLoading(true);
            showError(''); // Clear any previous errors
            
            auth0Instance.parseHash((err, authResult) => {
                if (authResult && authResult.accessToken && authResult.idToken) {
                    console.log('Authentication successful');
                    
                    // Calculate expiration time
                    const expiresAt = authResult.expiresIn * 1000 + new Date().getTime();
                    
                    // Store tokens
                    localStorage.setItem('access_token', authResult.accessToken);
                    localStorage.setItem('id_token', authResult.idToken);
                    localStorage.setItem('expires_at', JSON.stringify(expiresAt));
                    
                    // Also store as auth_token for compatibility with dashboard
                    localStorage.setItem('auth_token', authResult.accessToken);
                    
                    // Get user info
                    auth0Instance.client.userInfo(authResult.accessToken, (err, user) => {
                        if (err) {
                            console.error('Failed to get user info:', err);
                            showError('Authentication succeeded but failed to get user information');
                            showLoading(false);
                            reject(new Error('Failed to get user information'));
                            return;
                        }
                        
                        // Store user info
                        localStorage.setItem('user', JSON.stringify(user));
                        
                        // Store configuration for dashboard use
                        localStorage.setItem('timesheet_api_url', CONFIG.TIMESHEET_API_URL);
                        localStorage.setItem('auth_api_url', CONFIG.AUTH_API_URL);
                        
                        console.log('User information retrieved, redirecting to dashboard...');
                        showLoading(false);
                        
                        // Clean URL hash before redirect
                        if (window.location.hash) {
                            window.history.replaceState(null, null, window.location.pathname);
                        }
                        
                        // Small delay to ensure localStorage is written
                        setTimeout(() => {
                            window.location.href = '/dashboard.html';
                        }, 100);
                        
                        resolve({ user, authResult });
                    });
                    
                } else if (err) {
                    console.error('Authentication error:', err);
                    
                    // Clear any existing tokens on error
                    clearTokens();
                    
                    let errorMessage = 'Authentication failed';
                    if (err.error_description) {
                        errorMessage = err.error_description;
                    } else if (err.error) {
                        errorMessage = err.error.replace(/_/g, ' ');
                    }
                    
                    showError(errorMessage);
                    showLoading(false);
                    
                    // Clear URL hash and stay on login page
                    if (window.location.hash) {
                        window.history.replaceState(null, null, window.location.pathname);
                    }
                    
                    reject(new Error(errorMessage));
                } else {
                    // No hash data, not a callback
                    showLoading(false);
                    resolve(null);
                }
            });
        });
    }
    
    /**
     * Check if user is authenticated
     */
    function isAuthenticated() {
        try {
            const expiresAt = JSON.parse(localStorage.getItem('expires_at') || '0');
            const now = new Date().getTime();
            const accessToken = localStorage.getItem('access_token');
            
            if (accessToken && now < expiresAt) {
                return true;
            }
            
            // Token expired or missing, clear it
            if (accessToken) {
                console.log('Token expired, clearing authentication data');
                clearTokens();
            }
            
            return false;
        } catch (error) {
            console.error('Error checking authentication status:', error);
            clearTokens();
            return false;
        }
    }
    
    /**
     * Get current user information
     */
    function getCurrentUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Failed to parse user data:', error);
            return null;
        }
    }
    
    /**
     * Get access token
     */
    function getAccessToken() {
        if (isAuthenticated()) {
            return localStorage.getItem('access_token');
        }
        return null;
    }
    
    /**
     * Clear all tokens and user data
     */
    function clearTokens() {
        const itemsToRemove = [
            'access_token',
            'id_token', 
            'expires_at',
            'user',
            'auth_token'
        ];
        
        itemsToRemove.forEach(item => {
            localStorage.removeItem(item);
        });
    }
    
    /**
     * Logout user
     */
    function logout() {
        clearTokens();
        
        if (auth0Instance && authConfigData) {
            // Auth0 logout with proper cleanup
            auth0Instance.logout({
                returnTo: CONFIG.LOGOUT_URI,
                clientID: authConfigData.auth0_client_id
            });
        } else {
            // Fallback redirect
            window.location.href = CONFIG.LOGOUT_URI;
        }
        
        // Also sign out from Google if available
        try {
            if (typeof gapi !== 'undefined' && gapi.auth2) {
                const authInstance = gapi.auth2.getAuthInstance();
                if (authInstance && authInstance.isSignedIn.get()) {
                    authInstance.signOut();
                }
            }
        } catch (error) {
            console.warn('Failed to sign out from Google:', error);
        }
    }
    
    /**
     * Get authorization header for API calls
     */
    function getAuthHeader() {
        const token = getAccessToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
    
    /**
     * Make authenticated API call
     */
    async function apiCall(url, options = {}) {
        const token = getAccessToken();
        if (!token) {
            throw new Error('No access token available');
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (response.status === 401) {
                // Token expired or invalid
                console.log('API call returned 401, clearing tokens and redirecting to login');
                clearTokens();
                window.location.href = '/';
                throw new Error('Authentication expired');
            }
            
            return response;
        } catch (error) {
            if (error.message === 'Authentication expired') {
                throw error;
            }
            console.error('API call failed:', error);
            throw new Error(`API call failed: ${error.message}`);
        }
    }
    
    // UI Management Functions
    function showError(message) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            if (message) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                
                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (errorDiv.textContent === message) { // Only hide if message hasn't changed
                        errorDiv.style.display = 'none';
                    }
                }, 10000);
            } else {
                errorDiv.style.display = 'none';
            }
        }
    }

    function showLoading(show) {
        const loadingDiv = document.getElementById('loading');
        const buttons = document.querySelectorAll('.login-btn');
        
        if (loadingDiv) {
            loadingDiv.style.display = show ? 'block' : 'none';
        }
        
        buttons.forEach(btn => {
            if (show) {
                btn.style.opacity = '0.5';
                btn.disabled = true;
            } else {
                btn.style.opacity = '1';
                // Don't automatically enable - let enableButtons handle this
            }
        });
    }

    function enableButtons(enable) {
        const buttons = document.querySelectorAll('.login-btn');
        buttons.forEach(btn => {
            btn.disabled = !enable;
            if (enable) {
                btn.style.opacity = '1';
            } else {
                btn.style.opacity = '0.5';
            }
        });
        
        // Hide Google button if Google auth is not configured
        const googleBtn = document.getElementById('googleBtn');
        if (googleBtn && authConfigData) {
            if (!authConfigData.google_client_id || 
                authConfigData.google_client_id.startsWith('placeholder') ||
                authConfigData.google_client_id === 'your-google-client-id') {
                googleBtn.style.display = 'none';
            }
        }
    }
    
    // Page initialization and event handling
    async function initializePage() {
        console.log('Page loaded, initializing authentication...');
        
        try {
            // Check if we're handling a callback first
            if (window.location.hash.includes('access_token') || 
                window.location.hash.includes('id_token') || 
                window.location.hash.includes('error')) {
                console.log('Handling authentication callback...');
                
                // Initialize auth system first
                await initialize();
                
                // Then handle the callback
                await handleCallback();
                return;
            }

            // Check if user is already authenticated
            if (isAuthenticated()) {
                console.log('User already authenticated, redirecting to dashboard...');
                // Ensure config is available for dashboard
                localStorage.setItem('timesheet_api_url', CONFIG.TIMESHEET_API_URL);
                if (CONFIG.AUTH_API_URL) {
                    localStorage.setItem('auth_api_url', CONFIG.AUTH_API_URL);
                }
                window.location.href = '/dashboard.html';
                return;
            }

            // Initialize authentication for new login
            await initialize();
            console.log('Authentication system ready for user interaction');
            
        } catch (error) {
            console.error('Page initialization error:', error);
            showError(`Initialization failed: ${error.message}`);
            enableButtons(false);
        }
    }
    
    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage);
    } else {
        // Document already loaded
        initializePage();
    }
    
    // Handle browser back/forward button
    window.addEventListener('popstate', () => {
        if (window.location.hash.includes('access_token') || 
            window.location.hash.includes('id_token') || 
            window.location.hash.includes('error')) {
            handleCallback();
        }
    });
    
    // Initialize buttons as disabled until auth is ready
    if (document.readyState !== 'loading') {
        enableButtons(false);
    } else {
        document.addEventListener('DOMContentLoaded', () => enableButtons(false));
    }
    
    // Public API
    return {
        // Configuration
        CONFIG,
        
        // Core authentication functions
        initialize,
        login,
        signup,
        loginWithGoogle,
        handleCallback,
        logout,
        
        // State checks
        isAuthenticated,
        getCurrentUser,
        getAccessToken,
        getAuthHeader,
        
        // API utilities
        apiCall,
        clearTokens,
        
        // UI functions (for external use if needed)
        showError,
        showLoading,
        enableButtons
    };
    
})();

// Global handler functions for HTML onclick events
async function handleGoogleLogin() {
    try {
        await window.vibesheets.loginWithGoogle();
    } catch (error) {
        console.error('Google login handler error:', error);
        window.vibesheets.showError('Google login failed: ' + error.message);
    }
}

async function handleAuth0Login() {
    try {
        await window.vibesheets.login();
    } catch (error) {
        console.error('Auth0 login handler error:', error);
        window.vibesheets.showError('Login failed: ' + error.message);
    }
}

async function handleAuth0Signup() {
    try {
        await window.vibesheets.signup();
    } catch (error) {
        console.error('Auth0 signup handler error:', error);
        window.vibesheets.showError('Signup failed: ' + error.message);
    }
}