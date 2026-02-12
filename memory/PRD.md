# My Coach Developer - Product Requirements Document

## Overview
"My Coach Developer" is a lightweight, iPad-first, offline-capable PWA for coach observations, featuring email/password authentication and distinct roles for "Coach Developer" (admin) and "Coach".

## Core Features

### Authentication
- **Email/Password Authentication** - Primary login method
- **Role-based access control** - Coach Developer and Coach roles
- **Invite system** - Coach Developers can invite new users
- **Password reset via email**
- ~~Google OAuth~~ - **REMOVED** (caused deployment issues)

### Coach Developer (Admin) Features
- Create and manage observation sessions
- View and manage coaches ("My Coaches")
- Customize observation templates
- Schedule future observations
- View upcoming observations on dashboard
- Set club/organization branding (name + logo)
- Invite and manage users
- Access data recovery tools

### Coach Features
- View personal dashboard with assigned sessions
- Access "My Sessions" list
- View session details and observations
- Add reflections to sessions
- Edit profile information
- Permanent navigation bar (Dashboard, My Sessions, My Profile)

### Cloud Sync
- **MongoDB Cloud Database** - All sessions stored in cloud
- **Real-time sync status indicator** - Shows "Synced", "Syncing...", "Offline", or "Error"
- **Multi-device access** - Sessions accessible from any device
- **Offline support** - Falls back to localStorage when offline
- **Auto-sync** - Sessions automatically sync every 5 seconds during observation

### Data Model

#### observation_sessions Collection
```
{
  session_id: string,
  name: string,
  coach_id: string (optional),
  observer_id: string,
  observation_context: "training" | "game",
  status: "planned" | "draft" | "active" | "completed",
  planned_date: string (optional),
  created_at: string,
  updated_at: string,
  intervention_types: Array,
  descriptor_group1: Object,
  descriptor_group2: Object,
  session_parts: Array,
  start_time: string,
  end_time: string,
  total_duration: number,
  ball_rolling_time: number,
  ball_not_rolling_time: number,
  events: Array,
  ball_rolling_log: Array,
  observer_reflections: Array,
  coach_reflections: Array,
  session_notes: string,
  ai_summary: string,
  attachments: Array
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Observation Sessions (Cloud Sync)
- `GET /api/observations` - List all sessions for user
- `GET /api/observations/{session_id}` - Get session details with coach_name
- `POST /api/observations` - Create/upsert session
- `PUT /api/observations/{session_id}` - Update session
- `DELETE /api/observations/{session_id}` - Delete session

### Coaches
- `GET /api/coaches` - List coaches
- `GET /api/coaches/{coach_id}` - Get coach details
- `GET /api/coaches/{coach_id}/sessions` - **NEW** Get all sessions for a specific coach
- `PUT /api/coaches/{coach_id}` - Update coach profile
- `DELETE /api/coaches/{coach_id}` - Delete coach profile

### Other
- `GET /api/organization` - Get club branding
- `PUT /api/organization` - Update club branding
- `GET /api/session-parts` - Get session part templates

## Tech Stack
- **Frontend:** React, TailwindCSS, Shadcn UI
- **Backend:** FastAPI, Pydantic
- **Database:** MongoDB
- **State Management:** React Context (Auth, Organization, CloudSync)
- **Offline Support:** localStorage fallback + service worker

## Completed Work (February 2026)

### Phase 1: Data Recovery
- [x] Created `/data-recovery` page for exporting localStorage data
- [x] Added "Admin" tab in Settings with data recovery link
- [x] Export to clipboard and download as JSON file

### Phase 2: Database Integration
- [x] Created `observation_sessions` MongoDB collection
- [x] Added CRUD endpoints: GET, POST, PUT, DELETE for `/api/observations`
- [x] Sessions tagged with `observer_id` for user-specific data
- [x] Auto-sync to `sessions` collection for coach access

### Phase 3: Sync & Multi-Device Access
- [x] Created `cloudSessionService.js` for cloud operations
- [x] Created `CloudSyncContext` for app-wide sync state
- [x] Created `SyncStatusIndicator` component
- [x] Updated `LiveObservation` to save to cloud
- [x] Updated `HomePage` to load sessions from cloud
- [x] Added sync status to header and observation view

### Google Auth Removal
- [x] Removed Google login buttons from LoginPage
- [x] Disabled Google auth flow in AuthContext
- [x] Email/password is now the only auth method

### My Development Page
- [x] Added `/coach/development` route in App.js
- [x] Added "My Development" tab to all coach navigation (4 tabs total)
- [x] Page includes charts for intervention analysis, ball rolling time, session trends

### Club Branding Signup
- [x] Added `/api/users/check-first` endpoint to check if first user
- [x] Added club_name and club_logo fields to SignupRequest model
- [x] Signup creates organization with club branding for first user
- [x] Club fields shown conditionally in signup form

### Bug Fixes - February 12, 2026
- [x] **Fixed session-coach linking**: Added new endpoint `/api/coaches/{coach_id}/sessions` to fetch all sessions for a specific coach (was returning 404)
- [x] **Fixed coach name display**: ReviewSession.jsx now displays coach name in header when `session.coachName` is available
- [x] **Fixed runtime crashes**: Added extensive null checks in ReviewSession.jsx for:
  - `session.events` -> `(session.events || [])`
  - `session.sessionParts` -> `(session.sessionParts || [])`
  - `session.eventTypes` -> `(session.interventionTypes || session.eventTypes || [])`
  - `event.descriptors1/2` -> `(event.descriptors1 || [])`
  - `session.descriptorGroup1?.descriptors` -> optional chaining
- [x] **Fixed CoachProfile.jsx**: Updated API endpoint from `/api/coach/sessions/${coachId}` to `/api/coaches/${coachId}/sessions`
- [x] **Session parts filtering**: ReviewSession.jsx now only shows session parts that have data (events or ball rolling time) in the toggle
- [x] **Skeleton loading UI**: Added skeleton loading state for Coach Profile sessions tab while data loads from API

## Remaining Work / Backlog

### P1 - High Priority  
- [ ] Test full end-to-end cloud sync flow on production environment
- [ ] Ensure offline-to-online sync handles conflicts properly
- [ ] Investigate "body stream already read" error in safeFetch.js

### P2 - Medium Priority
- [ ] Extend offline sync to admin pages
- [ ] Session comparison view for coaches
- [ ] iPad portrait orientation optimizations
- [ ] Full audit for remaining localStorage usage

### P3 - Future
- [ ] Export sessions as PDF reports
- [ ] Email session summaries to coaches
- [ ] Video attachment support
- [ ] Team-level analytics dashboard

## Credentials (Preview Environment)
- **Coach Developer:** joemorrisseyg@gmail.com / 12345
- **Coach:** joe_morrissey@hotmail.co.uk / CoachTest123

## 3rd Party Integrations
- **Resend (Email API)** - Requires User API Key
- **recharts** - Charting library for React
