# VibeSheets Frontend

A modern timesheet tracking application with Auth0 authentication and responsive design.

## Technology Stack

- **HTML/CSS/JS** - Static web application
- **Auth0** - Authentication with Google OAuth
- **Responsive Design** - Mobile-first approach
- **AWS S3 + CloudFront** - Static hosting

## Key Features

- Auth0 and Google OAuth authentication
- Real-time clock in/out functionality
- Time entry management (view, edit, delete)
- Period-based filtering (daily, weekly, monthly)
- CSV export functionality
- Mobile-responsive design

## Project Structure

```
Frontend/
├── index.html           # Login page
├── dashboard.html       # Main timesheet interface
├── assets/
│   ├── css/            # Styling files
│   └── js/             # JavaScript functionality
└── README.md
```

## Development

The application is built with vanilla JavaScript and deployed as static files to AWS S3 with CloudFront distribution.

## Live Demo

Visit [vibesheets.com](https://vibesheets.com) to see the application in action.