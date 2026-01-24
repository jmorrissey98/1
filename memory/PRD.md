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

### Coach Development Analytics (NEW - Jan 24, 2026)
- **My Development** page with charts showing:
  - Average ball rolling percentage across sessions
  - Intervention type distribution (Command, Q&A, Guided Discovery, Transmission)
  - Content Focus breakdown (Technical, Tactical, Physical, Psych, Social)
  - Delivery Method breakdown (Visual Demo, Triggers, Kinesthetic)
  - Ball rolling percentage over time (line chart)
- Timeframe filter (Last 30 Days, Last 90 Days, All Time)
- Persistent timeframe preference per user

## Role-Based Access Control

### Coach Developer (Admin) Permissions
| Capability | Access |
|------------|--------|
| View all sessions | ✅ |
| Create observations | ✅ |
| Manage users/invites | ✅ |
| View all coaches | ✅ |
| Schedule observations | ✅ |
| Set coach targets | ✅ |

### Coach Permissions
| Capability | Access |
|------------|--------|
| View own sessions only | ✅ |
| Add reflections to own sessions | ✅ |
| View observations on own sessions | ✅ |
| Edit own profile (limited fields) | ✅ |
| View own targets | ✅ |
| View development analytics | ✅ |
| Create observations | ❌ |
| View other coaches | ❌ |
| Edit observation data | ❌ |

## Technical Architecture

### Stack
- **Frontend**: React, TailwindCSS, Shadcn UI, Recharts
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **Email**: Resend API (verified domain: mycoachdeveloper.com)
- **Auth**: Emergent Google OAuth + JWT-based email/password

### Key Files
```
/app/
├── backend/
│   └── server.py              # All API endpoints, auth, email, coach APIs
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── safeFetch.js   # Robust fetch wrapper
│   │   │   ├── storage.js     # Local storage utilities
│   │   │   └── offlineSync.js # Offline queue (partial)
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SyncContext.jsx
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx  # Role-based route protection
│   │   └── pages/
│   │       ├── CoachDashboard.jsx     # Coach home page
│   │       ├── CoachSessions.jsx      # My Sessions tab
│   │       ├── CoachSessionDetail.jsx # Session detail + reflection
│   │       ├── CoachProfileEdit.jsx   # Coach profile editing
│   │       └── ...
│   └── public/
│       ├── manifest.json
│       └── service-worker.js
└── .gitignore
```

### Coach Role API Endpoints
- `GET /api/coach/dashboard` - Aggregated dashboard data
- `GET /api/coach/sessions` - List coach's sessions
- `GET /api/coach/session/{id}` - Session detail (own only)
- `POST /api/coach/reflections` - Create reflection
- `PUT /api/coach/reflections/{id}` - Update reflection
- `GET /api/coach/profile` - Get coach profile
- `PUT /api/coach/profile` - Update profile (limited fields)
- `GET /api/coach/targets` - Get coach's targets
- `GET /api/scheduled-observations` - List scheduled observations
- `POST /api/scheduled-observations` - Create scheduled observation (admin)

### Data Models

#### Reflections Collection
```json
{
  "reflection_id": "ref_xxx",
  "session_id": "session_xxx",
  "coach_id": "coach_xxx",
  "content": "My reflection text...",
  "self_assessment_rating": 4,
  "strengths": "What went well...",
  "areas_for_development": "What to improve...",
  "created_at": "2026-01-22T...",
  "updated_at": "2026-01-22T..."
}
```

#### Scheduled Observations Collection
```json
{
  "schedule_id": "sched_xxx",
  "coach_id": "coach_xxx",
  "observer_id": "user_xxx",
  "scheduled_date": "2026-02-01",
  "session_context": "U16 Training",
  "status": "scheduled",
  "created_at": "2026-01-22T..."
}
```

## Completed Work

### January 24, 2026 (Latest)
- ✅ **My Development Page with Charts (Feature #5)**
  - New `/api/coach/development-data` backend endpoint that aggregates:
    - Average ball rolling percentage across sessions
    - Intervention type distribution (Command, Q&A, etc.)
    - Content Focus breakdown (Technical, Tactical, etc.)
    - Delivery Method breakdown (Visual Demo, Triggers, etc.)
    - Session data over time for trend charts
  - New `CoachDevelopment.jsx` page with:
    - Key metrics cards (Avg Ball Rolling, Sessions Observed, Total Interventions)
    - Ball Rolling Over Time line chart
    - Intervention Types bar + pie charts
    - Content Focus bar chart
    - Delivery Method bar chart
  - Timeframe filter (Last 30 Days, Last 90 Days, All Time) with persistence per user
  - Navigation tabs added to all coach pages (Dashboard, My Development, My Sessions, My Profile)
  - Route registered at `/coach/development`

### January 23, 2026
- ✅ **Offline Sync Integration**
  - Created `offlineApi.js` with offline-capable API wrappers
  - Coach Dashboard, Sessions, and Profile Edit now use offline-first data access
  - Data is cached locally and syncs when connection is restored
  - Extended sync queue to handle reflections, profile updates, and coach targets
  - Visual indicators show offline/cached status in headers
- ✅ **Deployment & Environment Fixes**
  - Fixed hardcoded credentials to use environment variables with fallbacks
  - Improved CORS configuration to handle wildcard origins properly
  - Cleaned up orphaned invites when coaches are deleted
- ✅ **Add Coach Flow (UI Verified)**
  - Coach Developer can add coaches from "My Coaches" page
  - Requires email field (mandatory)
  - Automatically creates an invite for the email
  - Shows "Pending" status until coach signs up
- ✅ **Delete Coach Flow (UI Verified)**
  - Confirmation dialog before deletion
  - Deletes coach profile and associated pending invites
  - User account remains intact if linked
- ✅ **Coach Signup Flow (E2E Verified)**
  - Fixed: Coach profile now auto-links to user on signup
  - Coach status updates from "Pending" to "Active" on signup
  - User gets correct role and linked_coach_id
  - Coach can access their dashboard immediately after signup
- ✅ **Coach Role Experience (UI Verified)**
  - Coach Dashboard showing profile, targets, observations, sessions
  - My Sessions page with search functionality
  - Profile Edit page with editable fields

### January 22, 2026 
- ✅ **Coach Role Implementation**
  - Coach dashboard with profile, targets, upcoming observations
  - My Sessions tab with session list and detail view
  - Reflection system (create, update, view)
  - Profile editing (limited fields: role, age group, department, bio)
  - Role-based routing and access control
  - Backend security: all coach queries filtered by coach_id
- ✅ Fixed CORS configuration for custom domain
- ✅ Fixed cross-domain cookie issue (relative URLs)
- ✅ Fixed .gitignore blocking .env files
- ✅ Hardcoded Resend configuration for reliability
- ✅ Email retry logic with exponential backoff
- ✅ Email status tracking on invites

### Previously Completed
- ✅ Dual authentication (Google OAuth + Email/Password)
- ✅ Password reset flow with Resend emails
- ✅ User invite system with role assignment
- ✅ Coach profile management with targets
- ✅ Session observation and AI summaries
- ✅ PWA manifest and basic service worker

## Backlog

### P1 - Upcoming
- Extend offline sync to Admin (Coach Developer) pages
- Add sessions storage to database with coach_id linking

### P2 - Future
- Session comparison view
- iPad portrait orientation optimizations
- Full PWA offline-first experience with service worker caching
- Coach notification system

## Configuration

### Environment Variables
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
RESEND_API_KEY=re_xxxxx (reads from env, has fallback)
SENDER_EMAIL=noreply@mycoachdeveloper.com (reads from env, has fallback)
APP_URL=https://mycoachdeveloper.com (reads from env, has fallback)
CORS_ORIGINS=* (or comma-separated list of allowed origins)
```

### Deployment Notes
1. Frontend uses relative API URLs for same-domain deployment
2. CORS configured to support wildcard (*) or specific origins list
3. Environment variables are read with fallbacks for reliability
4. Check `/api/config-check` after deployment to verify
5. Delete coach also cleans up associated pending invites

### Test Credentials
- **Coach Developer**: joemorrisseyg@gmail.com / MCD26 (or Google Auth)
- **Coach**: Invite via Settings or "My Coaches" page, then sign up
