# VibeSheets Frontend - React SPA with Modern Architecture

[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.0.0-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Auth0](https://img.shields.io/badge/Auth0-Authentication-EB5424?style=flat&logo=auth0)](https://auth0.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)

A modern, production-ready React single-page application featuring Auth0 authentication, real-time time tracking, and responsive design. Built with cutting-edge frontend technologies and optimized for performance.

## 🚀 Live Demo

**Production:** [vibesheets.com](https://vibesheets.com)

## ⚡ Quick Start

```bash
# Clone and navigate
git clone https://github.com/vibesheets/vibesheets.git
cd vibesheets/Frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🏗️ Architecture Overview

### Modern React Stack
- **React 19.1** - Latest React with concurrent features
- **Vite 7.0** - Lightning-fast build tool and dev server
- **ES Modules** - Modern JavaScript module system
- **Context API** - State management for authentication
- **Custom Hooks** - Reusable logic abstraction
- **Component Composition** - Modular, maintainable architecture

### Key Design Patterns
- **Container/Presentational Components** - Clear separation of logic and UI
- **Higher-Order Components** - Auth protection and route guards
- **Context + useReducer** - Scalable state management
- **Custom Hook Pattern** - Reusable business logic
- **Error Boundaries** - Graceful error handling
- **Code Splitting** - Optimized bundle loading

## 📂 Project Structure

```
Frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── Login.jsx        # Auth0 + Google OAuth login
│   │   ├── Dashboard.jsx    # Main timesheet interface
│   │   ├── ClockCard.jsx    # Time tracking component
│   │   ├── HoursCard.jsx    # Hours summary display
│   │   ├── TimeEntriesCard.jsx  # Time entries management
│   │   └── ExportCard.jsx   # Timesheet export functionality
│   ├── contexts/            # React Context providers
│   │   └── AuthContext.jsx  # Authentication state management
│   ├── services/            # API layer and external services
│   │   └── api.js          # HTTP client with interceptors
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Helper functions and utilities
│   ├── assets/             # Static assets (images, icons)
│   ├── App.jsx             # Root component with routing
│   └── main.jsx            # Application entry point
├── public/                 # Static assets served directly
├── dist/                   # Production build output
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## 🔧 Core Technologies & Features

### Frontend Framework
- **React 19.1** with StrictMode for development safety
- **Vite** for instant HMR and optimized builds
- **ESLint** with React-specific rules and hooks linting
- **Modern JavaScript** (ES2022+) with module syntax

### Authentication & Security
- **Auth0 Integration** - Enterprise-grade authentication
- **Google OAuth** - Social login integration
- **JWT Token Management** - Secure API authentication
- **Protected Routes** - Authentication-based navigation
- **Session Persistence** - Automatic login restoration
- **Secure Token Storage** - localStorage with expiration

### State Management
```javascript
// Context-based authentication state
const AuthContext = createContext();

// Custom hook for auth operations
const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};

// Protected component pattern
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Login />;
};
```

### API Integration
```javascript
// Modern fetch-based API client
class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...options
    });
  }
}
```

### Real-time Features
- **Live Clock Display** - Real-time updates every second
- **Dynamic Status Updates** - Clock in/out state management
- **Responsive UI Updates** - Immediate feedback on user actions
- **Session Recovery** - Automatic state restoration

## 🎨 UI/UX Design

### Modern Design System
- **Glassmorphism Effects** - Translucent cards with backdrop blur
- **Gradient Backgrounds** - Professional color schemes
- **Responsive Grid Layout** - CSS Grid and Flexbox
- **Interactive Animations** - Smooth hover and click effects
- **Mobile-First Design** - Optimized for all screen sizes

### Component Architecture
```javascript
// Reusable card component with glassmorphism
const Card = ({ children, className }) => (
  <div className={`glass-card ${className}`}>
    {children}
  </div>
);

// Styled clock component with real-time updates
const ClockCard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <h2>Current Time</h2>
      <div className="time-display">
        {formatTime(currentTime)}
      </div>
    </Card>
  );
};
```

### Accessibility Features
- **ARIA Labels** - Screen reader support
- **Keyboard Navigation** - Full keyboard accessibility
- **Focus Management** - Proper focus indicators
- **Color Contrast** - WCAG AA compliance
- **Semantic HTML** - Proper heading hierarchy

## 🔄 State Management Patterns

### Authentication Flow
```javascript
// AuthContext provider with comprehensive state management
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  const login = async (provider) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const result = await auth0Client.authorize(provider);
      dispatch({ type: 'LOGIN_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: error });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Data Fetching Patterns
```javascript
// Custom hook for API data fetching
const useTimeEntries = (dateRange) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiService.getTimesheets(dateRange);
        setData(await response.json());
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dateRange]);

  return { data, loading, error };
};
```

## 📱 Responsive Design

### Mobile-First Approach
- **CSS Grid** - Responsive layout system
- **Breakpoint Strategy** - Mobile, tablet, desktop optimized
- **Touch-Friendly UI** - Optimized for mobile interactions
- **Progressive Enhancement** - Works on all devices

### Performance Optimizations
- **Code Splitting** - Lazy loading for optimal bundle size
- **Tree Shaking** - Eliminate unused code
- **Asset Optimization** - Compressed images and assets
- **Caching Strategy** - Browser and CDN caching
- **Bundle Analysis** - webpack-bundle-analyzer integration

## 🛡️ Security Implementation

### Frontend Security Measures
```javascript
// XSS Protection
const sanitizeInput = (input) => {
  return DOMPurify.sanitize(input);
};

// CSRF Protection
const apiClient = axios.create({
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Secure token handling
const TokenManager = {
  store: (token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('token_expiry', Date.now() + (60 * 60 * 1000));
  },
  
  isValid: () => {
    const expiry = localStorage.getItem('token_expiry');
    return expiry && Date.now() < parseInt(expiry);
  }
};
```

## ⚡ Performance Features

### Build Optimizations
- **Vite Build** - Fast builds with rollup
- **Code Splitting** - Route-based lazy loading
- **Asset Optimization** - Automatic minification
- **Tree Shaking** - Dead code elimination
- **Module Preloading** - Optimized loading strategies

### Runtime Performance
- **React.memo** - Component memoization
- **useMemo/useCallback** - Expensive computation caching
- **Virtual Scrolling** - Large list optimization
- **Debounced Inputs** - Optimized user input handling
- **Service Workers** - Offline functionality (planned)

## 🧪 Development Workflow

### Development Server
```bash
# Hot module replacement with instant updates
npm run dev

# Access at http://localhost:5173
# Automatic browser refresh on file changes
# Error overlay for debugging
```

### Code Quality
```bash
# ESLint for code quality
npm run lint

# Prettier for code formatting (via ESLint)
# Pre-commit hooks for code consistency
# TypeScript support for type safety
```

### Build Process
```bash
# Production build
npm run build

# Outputs to dist/ directory
# Automatic minification and optimization
# Source maps for debugging
```

## 🚀 Deployment

### Build Output
- **Static Assets** - Optimized for CDN delivery
- **Service Worker** - Offline support (planned)
- **Asset Hashing** - Cache busting for updates
- **Compression** - Gzip/Brotli ready

### Environment Configuration
```javascript
// Environment-specific configuration
const config = {
  development: {
    API_URL: 'http://localhost:3001',
    DEBUG: true
  },
  production: {
    API_URL: 'https://api.vibesheets.com',
    DEBUG: false
  }
};
```
For more information about the complete VibeSheets application, see the [main repository README](../README.md).
