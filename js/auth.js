let auth0Client;
let authConfig;

// Check auth status immediately on index page to avoid flash
if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && 
    localStorage.getItem('access_token') && 
    isAuthenticated()) {
    // Hide the page content immediately and redirect
    document.documentElement.style.visibility = 'hidden';
    window.location.href = '/dashboard.html';
}

// Initialize Auth0 when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Restore visibility in case redirect didn't happen
    document.documentElement.style.visibility = 'visible';
    
    try {
        // Get Auth0 configuration from API with retry logic
        let config = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch('https://api.vibesheets.com/auth');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                config = await response.json();
                break;
            } catch (fetchError) {
                attempts++;
                console.warn(`Auth config fetch attempt ${attempts} failed:`, fetchError);
                if (attempts < maxAttempts) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                } else {
                    throw new Error(`Failed to load auth configuration after ${maxAttempts} attempts: ${fetchError.message}`);
                }
            }
        }
        
        if (!config || !config.auth0) {
            throw new Error('Invalid auth configuration received');
        }
        
        authConfig = config.auth0; // Extract auth0 config from response
        
        // Validate required auth config fields
        const requiredFields = ['domain', 'clientId', 'redirectUri', 'audience', 'scope'];
        for (const field of requiredFields) {
            if (!authConfig[field]) {
                throw new Error(`Missing required auth config field: ${field}`);
            }
        }
        
        // Initialize Auth0 client
        auth0Client = new auth0.WebAuth({
            domain: authConfig.domain,
            clientID: authConfig.clientId,
            redirectUri: authConfig.redirectUri,
            audience: authConfig.audience,
            responseType: 'token id_token',
            scope: authConfig.scope
        });

        // Check if we're on the callback page with auth parameters
        console.log('Current URL:', window.location.href);
        console.log('Current hash:', window.location.hash);
        
        if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
            console.log('Found auth callback, processing...');
            // Hide login form and show loading during callback processing
            const loginContainer = document.querySelector('.login-container');
            if (loginContainer) {
                loginContainer.style.display = 'none';
            }
            showLoading(true);
            handleAuthCallback();
        } else if (window.location.pathname === '/dashboard.html') {
            // On dashboard page
            if (isAuthenticated()) {
                // Already authenticated, initialize dashboard
                console.log('Already authenticated, initializing dashboard');
                if (typeof initializeDashboard === 'function') {
                    initializeDashboard();
                }
            } else {
                // Not authenticated but on dashboard, redirect to login
                console.log('Not authenticated, redirecting to login');
                window.location.href = '/';
            }
        } else if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            // On login page
            if (isAuthenticated()) {
                // Already authenticated, redirect to dashboard immediately
                console.log('Already authenticated, redirecting to dashboard');
                // Hide login form and show loading during redirect
                const loginContainer = document.querySelector('.login-container');
                if (loginContainer) {
                    loginContainer.style.display = 'none';
                }
                showLoading(true);
                window.location.href = '/dashboard.html';
            }
        }
    } catch (error) {
        console.error('Failed to initialize auth:', error);
        showError('Authentication initialization failed. Please refresh the page or try again later.');
        
        // Hide login buttons to prevent confusing user
        const buttons = document.querySelectorAll('.login-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
    }
});

// Handle Google login
function handleGoogleLogin() {
    if (!auth0Client) {
        showError('Authentication not initialized. Please refresh the page.');
        return;
    }
    
    showLoading(true);
    auth0Client.authorize({
        connection: 'google-oauth2'
    });
}

// Handle Auth0 email login
function handleAuth0Login() {
    if (!auth0Client) {
        showError('Authentication not initialized. Please refresh the page.');
        return;
    }
    
    showLoading(true);
    auth0Client.authorize();
}

// Handle Auth0 signup
function handleAuth0Signup() {
    if (!auth0Client) {
        showError('Authentication not initialized. Please refresh the page.');
        return;
    }
    
    showLoading(true);
    auth0Client.authorize({
        screen_hint: 'signup'
    });
}

// Handle authentication callback
function handleAuthCallback() {
    if (!auth0Client) {
        console.error('Auth0 client not initialized');
        return;
    }
    
    console.log('Parsing auth hash...');
    auth0Client.parseHash((err, authResult) => {
        console.log('Parse hash result:', { err, authResult });
        
        if (authResult && authResult.accessToken && authResult.idToken) {
            console.log('Successfully parsed tokens');
            
            // Store tokens with proper expiration from Auth0
            localStorage.setItem('access_token', authResult.accessToken);
            localStorage.setItem('id_token', authResult.idToken);
            
            // Use the actual expiration time from Auth0 (typically 1 hour)
            const expiresAt = new Date().getTime() + (authResult.expiresIn * 1000);
            localStorage.setItem('expires_at', JSON.stringify(expiresAt));
            
            // Get user info
            auth0Client.client.userInfo(authResult.accessToken, (err, user) => {
                if (err) {
                    console.error('Failed to get user info:', err);
                    // Still proceed even if user info fails
                    localStorage.setItem('user', JSON.stringify({ email: 'unknown' }));
                } else {
                    console.log('Got user info:', user);
                    localStorage.setItem('user', JSON.stringify(user));
                }
                
                // Clear the hash from URL to clean it up
                window.history.replaceState(null, null, window.location.pathname);
                
                console.log('Authentication successful, redirecting to dashboard');
                
                // Always redirect to dashboard after successful auth
                if (window.location.pathname !== '/dashboard.html') {
                    window.location.href = '/dashboard.html';
                } else {
                    // Already on dashboard, initialize it
                    if (typeof initializeDashboard === 'function') {
                        initializeDashboard();
                    }
                }
            });
        } else if (err) {
            console.error('Authentication error:', err);
            showError('Authentication failed: ' + (err.errorDescription || err.error));
            // Redirect to login page
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            console.warn('No auth result and no error - this is unexpected');
        }
    });
}

// Check if user is authenticated
function isAuthenticated() {
    const expiresAt = JSON.parse(localStorage.getItem('expires_at') || '0');
    const accessToken = localStorage.getItem('access_token');
    
    if (accessToken && expiresAt) {
        return new Date().getTime() < expiresAt;
    }
    
    return false;
}

// Get current user
function getCurrentUser() {
    if (isAuthenticated()) {
        return JSON.parse(localStorage.getItem('user') || 'null');
    }
    return null;
}

// Get access token
function getAccessToken() {
    if (isAuthenticated()) {
        return localStorage.getItem('access_token');
    }
    return null;
}

// Logout function
function logout() {
    // Clear local storage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('user');
    
    // Logout from Auth0
    if (auth0Client && authConfig) {
        auth0Client.logout({
            returnTo: window.location.origin,
            clientID: authConfig.clientId
        });
    } else {
        // Fallback redirect
        window.location.href = '/';
    }
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert(message);
    }
    showLoading(false);
}

function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    const buttons = document.querySelectorAll('.login-btn');
    
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'block' : 'none';
    }
    
    buttons.forEach(btn => {
        btn.disabled = show;
    });
}

// Handle redirects after page load (moved into DOMContentLoaded above)