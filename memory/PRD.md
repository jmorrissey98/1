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

### AI Summary Bug Fix - February 12, 2026
- [x] **Fixed AI Summary generation failure**: ReferenceError "storage is not defined" in handleGenerateSummary
  - **Root cause**: Leftover code from localStorage migration - `storage.getCoach()` was undefined
  - **Fix**: Replaced `storage.getCoach(session.coachId)?.name` with `session.coachName` (already populated by backend)
  - **Fix location**: ReviewSession.jsx line 314-316
  - Removed dead code: `getPreviousSessionsSummary()` function that also used undefined `storage`
  - Verified: AI summary now generates successfully without errors

### AI Summary Enhancements - February 12, 2026
- [x] **Coach Targets Integration**: Summary now includes coach's active development targets
  - Frontend fetches targets from `/api/coaches/{coach_id}` before generating
  - Filters for `status === 'active'` targets only
  - AI references targets in its analysis (e.g., "To hit your Q&A target...")
- [x] **Shorter Summary**: Reduced from ~400 words to ~150-180 words
  - Sections: SUMMARY (2-3 sentences), STRENGTHS (1-2 sentences), AREAS TO DEVELOP (1-2 sentences), 2 REFLECTIVE QUESTIONS
  - More concise and actionable feedback

### Session Display Logic Fixes - February 12, 2026
- [x] **HomePage Upcoming Observations**: Planned sessions now correctly appear in "Upcoming Observations" card (not "Your Sessions")
  - Shows session name, coach name, planned date
  - Includes "Start" button to begin observation immediately
  - Filters out sessions with expired planned dates
  - **NEW**: Added Edit (pencil) and Delete (trash) buttons for each planned session
- [x] **HomePage Your Sessions**: Now only shows draft, active, and completed sessions (excludes planned)
- [x] **SessionCalendar**: Now loads sessions from cloud API instead of localStorage
  - Shows planned sessions on their scheduled date (blue dot)
  - Shows completed sessions on their creation date (green dot)
  - Shows in-progress sessions (orange dot)
- [x] **CoachProfile Sessions Tab**: Completely redesigned to separate session types:
  - "Upcoming" section (blue background) - planned sessions with Edit, Delete, and "Start" buttons
  - "Observation History" section - completed sessions
  - "In Progress" section (orange background) - draft/active sessions
- [x] **MyCoaches Page**: Backend now returns `sessionCount` and `upcomingCount` per coach
  - Calendar icon shows completed session count
  - Clock icon badge shows upcoming planned sessions
- [x] **SessionSetup.jsx Runtime Error Fix**: Added comprehensive null checks for:
  - `session.eventTypes` / `session.interventionTypes` - safely handled with defaults
  - `session.descriptorGroup1` / `session.descriptorGroup2` - safely handled with defaults
  - All descriptor and event type operations now safely handle null values

### Session Summary UI Update - February 12, 2026
- [x] **Renamed from "AI Session Summary" to "Session Summary"**
- [x] **Removed purple styling** - now uses consistent card styling like other sections
- [x] **Added Edit functionality** - Edit button appears when summary exists
  - Click Edit to show textarea with summary content
  - Save/Cancel buttons to save changes or discard

### Bug Fixes - February 12, 2026
- [x] **Planned date not saving/displaying** - Fixed multiple issues:
  - Added `planned_date` field to `SessionListItem` model (was missing from API response)
  - Updated `list_observation_sessions` endpoint to include `planned_date`
  - Fixed SessionSetup to restore `sessionDate` when loading existing session for editing
  - Fixed `mergeSessionData` to preserve `plannedDate` and `status` during sync conflicts
- [x] **Coach reflections not appearing in coach developer view** - Fixed:
  - Backend now fetches reflections from separate `reflections` collection (coach-submitted)
  - Merged with any inline `coach_reflections` on the session document
  - Frontend now displays structured reflection fields: rating, text, what_went_well, areas_for_development
- [x] **Coach dashboard not showing upcoming sessions** - Fixed:
  - Backend `/api/coach/dashboard` now checks BOTH `scheduled_observations` collection AND `observation_sessions` with `status='planned'`
  - Planned sessions linked to coach now appear in their "Upcoming Observations" section

### Offline Sync for Admin Pages - February 12, 2026
- [x] **MyCoaches page now works offline**
  - Create coach works offline (queued with "Pending Sync" badge)
  - Delete coach works offline (queued)
  - Data loads from localStorage cache when offline
  - Offline banner shows "You're offline. Changes will sync when connected."
  - Pending sync count displayed in UI
- [x] **offlineApi.js enhancements**
  - Added `createCoach()` function with offline queue support
  - Added `deleteCoach()` function with offline queue support
  - Coach data cached in localStorage for offline access
- [x] **offlineSync.js enhancements**
  - Added CREATE_COACH queue item handler
  - Added DELETE_COACH queue item handler

## Remaining Work / Backlog

### P1 - High Priority  
- [ ] Test full end-to-end cloud sync flow on production environment
- [ ] Ensure offline-to-online sync handles conflicts properly
- [ ] Investigate "body stream already read" error in safeFetch.js

### P2 - Medium Priority
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
