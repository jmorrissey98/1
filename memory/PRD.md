# My Coach Developer - Product Requirements Document

## Overview
An iPad-first coach observation app for tracking and analyzing coaching sessions. Functions fully offline with data syncing when connection is available. Installable as a Progressive Web App (PWA).

## Core Features

### Authentication
- **Dual Auth**: Emergent Google OAuth + Email/Password authentication
- **Invite System**: Coach Developers invite Coaches via email
- **Roles**: Coach Developer (admin) and Coach (restricted view)

### Session Management
- Live observation with coaching intervention grid
- Session parts with global defaults
- AI-powered session summaries (using coach targets for context)

### Coach Management
- Coach profiles with development targets
- Session history per coach
- Data export capabilities

## Technical Architecture

### Stack
- **Frontend**: React, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **Email**: Resend API (verified domain: mycoachdeveloper.com)
- **Auth**: Emergent Google OAuth + JWT-based email/password

### Key Files
```
/app/
├── backend/
│   └── server.py          # All API endpoints, auth, email
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── safeFetch.js      # Robust fetch wrapper
│   │   │   ├── storage.js        # Local storage utilities
│   │   │   └── offlineSync.js    # Offline queue (partial)
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx   # Auth state management
│   │   │   └── SyncContext.jsx   # Online/offline state
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── UserSettings.jsx  # Invites, user management
│   │       └── ...
│   └── public/
│       ├── manifest.json         # PWA manifest
│       └── service-worker.js     # Offline caching
└── .gitignore                    # Fixed - allows .env deployment
```

### API Endpoints
- `POST /api/auth/session` - Google OAuth callback
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - New user registration
- `POST /api/invites` - Create invite (sends email)
- `POST /api/invites/{id}/resend` - Resend invite email
- `GET /api/config-check` - Diagnostic endpoint

## Completed Work

### January 22, 2026
- ✅ Fixed CORS configuration for custom domain (mycoachdeveloper.com)
- ✅ Fixed cross-domain cookie issue (API_URL now uses relative paths)
- ✅ Fixed .gitignore blocking .env files from deployment
- ✅ Added hardcoded fallbacks for Resend configuration
- ✅ Implemented email retry logic with exponential backoff
- ✅ Added email status tracking (email_sent field on invites)
- ✅ Added `/api/config-check` diagnostic endpoint
- ✅ Added `/api/invites/by-email/{email}` DELETE endpoint
- ✅ Improved error messages throughout the system

### Previously Completed
- ✅ Dual authentication (Google OAuth + Email/Password)
- ✅ Password reset flow with Resend emails
- ✅ User invite system with role assignment
- ✅ Coach profile management with targets
- ✅ Session observation and AI summaries
- ✅ PWA manifest and basic service worker

## Known Issues / Backlog

### P1 - In Progress
- Offline sync not fully integrated into all data mutations

### P2 - Future
- Session comparison view
- iPad portrait orientation optimizations
- Full PWA offline-first experience

## Configuration

### Environment Variables (backend/.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
RESEND_API_KEY=re_xxxxx
SENDER_EMAIL=noreply@mycoachdeveloper.com
APP_URL=https://mycoachdeveloper.com
EMERGENT_LLM_KEY=sk-emergent-xxxxx
```

### Resend Domain Setup
- Domain: mycoachdeveloper.com (verified)
- Sender: noreply@mycoachdeveloper.com
- Required DNS records: DKIM, SPF, MX for bounce handling

## Deployment Notes

1. Frontend uses relative API URLs (empty string) for same-domain deployment
2. CORS is configured for mycoachdeveloper.com
3. Hardcoded fallbacks ensure email works even if env vars fail
4. Check `/api/config-check` after deployment to verify configuration
