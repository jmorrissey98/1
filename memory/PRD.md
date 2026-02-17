# My Coach Developer - Product Requirements Document

## Overview
"My Coach Developer" is a lightweight, iPad-first, offline-capable PWA for coach observations, featuring email/password authentication and distinct roles for "Coach Developer" (admin) and "Coach".

**Production Domain:** mycoachdeveloper.com

## Core Features

### Authentication
- **Email/Password Authentication** - Primary login method
- **Role-based access control** - Admin, Coach Developer and Coach roles
- **Invite system** - Coach Developers can invite new users
- **Password reset via email**
- **Terms & Conditions** - Required acceptance on registration (Feb 16, 2026)
- **Marketing opt-in** - Optional newsletter subscription with consent tracking
- ~~Google OAuth~~ - **REMOVED** (caused deployment issues)

### Landing Page (Updated Feb 16, 2026)
- **Hero:** "Develop Your Coaches. Simple." (Simple in blue)
- **Body text:** "Keep your focus where it matters: developing your coaches. Observe sessions, build portfolios, and support progress with ease."
- **Features:**
  - Observe Sessions - Capture coaching moments in real time
  - Build Coach Portfolios - Bring together observations, notes, evidence
  - Support Development - Turn observations into development plans
- **Pricing tiers:**
  - Individual: £20/month, 5 coaches, 1 admin
  - Developer: £35/month, 15 coaches, 1 admin (Most Popular)
  - Club: £50/month, 50 coaches, 10 admins
- **Billing:** Monthly default, Annual shows "2 months free" badge

### Coach Developer (Admin) Features
- Create and manage observation sessions
- View and manage coaches ("My Coaches")
- Customize observation templates
- **Manage Reflection Templates (Phase 3 - COMPLETE)**
- Schedule future observations
- View upcoming observations on dashboard
- Set club/organization branding (name + logo)
- Invite and manage users
- Access data recovery tools
- **Subscription badge in Settings** - Shows current plan with upgrade option

### Coach Features
- View personal dashboard with assigned sessions
- Access "My Sessions" list
- View session details and observations
- Add reflections to sessions
- Edit profile information
- Permanent navigation bar (Dashboard, My Sessions, My Profile)
- **Can access their own coach profile without 403 errors (FIX)**

### Admin Features (Feb 16, 2026)
- Delete clubs/organizations
- Add coach developers to clubs directly
- View all clubs and users
- Impersonate users for debugging

### Cloud Sync
- **MongoDB Cloud Database** - All sessions stored in cloud
- **Real-time sync status indicator** - Shows "Synced", "Syncing...", "Offline", or "Error"
- **Multi-device access** - Sessions accessible from any device
- **Offline support** - Falls back to localStorage when offline
- **Auto-sync** - Sessions automatically sync every 5 seconds during observation

### Analytics Integration (NEW - Feb 14, 2026)
- **Google Analytics 4 (GA4)** - Measurement ID: G-713PP3YYYZ
- Production-only (disabled in dev/localhost)
- Tracks page views, feature usage, view duration
- User identification on login/logout

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

#### reflection_templates Collection (NEW - Phase 3)
```
{
  template_id: string,
  name: string,
  target_role: "coach_educator" | "coach",
  description: string (optional),
  questions: [
    {
      question_id: string,
      question_text: string,
      question_type: "text" | "scale" | "dropdown" | "checkbox",
      required: boolean,
      // Scale-specific fields
      scale_min: number,
      scale_max: number,
      scale_min_label: string,
      scale_max_label: string,
      // Dropdown/Checkbox options
      options: [string]
    }
  ],
  is_default: boolean,
  created_by: string,
  organization_id: string,
  created_at: string,
  updated_at: string
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
- `GET /api/coaches/{coach_id}/sessions` - Get all sessions for a specific coach
- `PUT /api/coaches/{coach_id}` - Update coach profile
- `DELETE /api/coaches/{coach_id}` - Delete coach profile

### Reflection Templates (NEW - Phase 3)
- `GET /api/reflection-templates` - List templates (filter by target_role)
- `GET /api/reflection-templates/{template_id}` - Get template details
- `POST /api/reflection-templates` - Create template
- `PUT /api/reflection-templates/{template_id}` - Update template
- `DELETE /api/reflection-templates/{template_id}` - Delete template
- `POST /api/reflection-templates/{template_id}/set-default` - Set as default
- `POST /api/reflection-templates/{template_id}/unset-default` - Remove default

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

## Completed Work

### Phase 1: UI/UX Fixes (COMPLETED - February 13, 2026)
- [x] Toast notifications moved to bottom-left
- [x] My Coaches page tip removed
- [x] Coach icons with descriptions (Sessions, Upcoming, Targets)
- [x] Coach selection mandatory in session setup

### Phase 2: User Logic & Invitations (COMPLETED - February 13, 2026)
- [x] Token-based invite registration (`/register/{invite_id}`)
- [x] Unified deletion (delete user also deletes coach profile)
- [x] Invite emails contain direct registration link

### Phase 3: Template System Expansion (COMPLETED - February 13, 2026)
- [x] Templates page restructured with Observation/Reflection tabs
- [x] Reflection Templates section with Coach Educators/Coaches sub-tabs
- [x] Reflection Template Builder with question types:
  - Text (free-form text response)
  - Scale (custom range with labels)
  - Dropdown (single choice from list)
  - Checkbox (multiple choice selection)
- [x] Default template system (one default per sub-tab)
- [x] Preview functionality
- [x] Edit, Delete, Duplicate templates
- [x] Backend API for reflection templates CRUD
- [x] Admin users have access to templates page

### Phase 4: Live Observation & Session Integration (COMPLETED - February 14, 2026)
- [x] Reflection Template selector in Session Setup page
- [x] Enable Observer Notes toggle in Session Setup
- [x] Coach info banner with expandable targets in Live Observation
- [x] Observer Notes panel during Live Observation
- [x] Add/delete observer notes during observation
- [x] Session Complete Reflection modal auto-triggered when ending session
- [x] Reflection modal with support for all question types (text, scale, checkbox)
- [x] Save reflection data to session
- [x] Skip reflection option
- [x] Fixed null pointer bugs in LiveObservation.jsx (sessionParts, descriptorGroups)

### Phase 5: UI/UX Refinements (COMPLETED - February 14, 2026)
- [x] Observer Notes UI - Removed purple theme, now uses neutral slate/gray colors
- [x] Observer Notes panel collapsed by default (not expanded on page load)
- [x] Relative timing (MM:SS) for events instead of wall-clock time
  - Events logged during Live Observation now store `relativeTimestamp`
  - Last event panel shows relative time format
  - Observer notes timestamps show relative time
  - Review Timeline displays MM:SS for sessions with relativeTimestamp
  - Backward compatible: Old sessions fall back to wall-clock time display
- [x] iPad portrait mode optimizations
  - CSS media queries for portrait orientation (768px-1024px)
  - Touch targets minimum 44px height
  - Scrollable tabs for session parts
  - Proper spacing and layout adjustments
  - No horizontal overflow in portrait mode

### Phase 6: Coach Development Experience (COMPLETED - February 15, 2026)
- [x] Phase A: Coach Calendar View
  - Created dedicated `/api/coach/calendar` endpoint
  - CoachCalendar.jsx shows only the logged-in coach's sessions
- [x] Phase A: Reflection Template Assignment Bug Fix
  - Fixed logic in ReviewSession.jsx to load templates assigned to sessions
- [x] Phase B: "My Development" Page
  - New CoachMyDevelopment.jsx with three tabs:
    - Overview Tab: Stats, development progress, sessions chart
    - My Sessions Tab: Search, filtering, session list
    - My Targets Tab: Add/edit/archive targets with CRUD
  - Backend endpoints: /api/coach/targets (GET/POST/PUT/DELETE)
- [x] Phase C: Session Activity Density Visualization
  - Replaced Timeline tab with "Activity" tab
  - Visual density bar showing when interventions occurred
  - Ball rolling/stopped segments as background colors
  - Event markers with hover tooltips
  - Summary stats: total interventions, avg gap, peak per minute
  - Condensed event list with timestamps
- [x] Phase D: Multi-Dimensional Intervention Analytics
  - InterventionAnalyticsModule component in Charts tab
  - Dynamic grouping: By Intervention, By Content Focus, By Delivery Method
  - Pattern insights (most common combination, variety %)
  - Stacked bar chart visualization
  - Cross-tabulation table with heatmap-style counts

### Phase 7: Session Review Redesign (COMPLETED - February 17, 2026)
- [x] Merged "Activity" and "Charts" tabs into a single "Session Analysis" tab
- [x] "Ball Rolling vs Stopped" chart moved to top with percentage-based compact view
- [x] Activity density visualization integrated into Session Analysis
- [x] Intervention Patterns section made collapsible (collapsed by default)
- [x] Removed redundant "Events distribution" card
- [x] Updated page header to show coach's name more prominently
- [x] Fixed tab grid layout (3 tabs now: Summary, Reflections, Session Analysis)

### Previous Work
- Stripe checkout integration
- Landing page with pricing
- Signup loophole closed
- White screen crash fixed
- Cloud sync for observation sessions
- Admin dashboard with impersonation
- Token-based authentication

### Phase 8: Backend Refactoring (IN PROGRESS - February 17, 2026)
- [x] Created `database.py` - Database connection and configuration
- [x] Created `models.py` - All Pydantic models (~400 lines extracted)
- [x] Created `dependencies.py` - Auth middleware (require_auth, require_admin, etc.)
- [x] Created `utils.py` - Utility functions (password hashing, email sending)
- [x] Created `routes/auth.py` - Authentication routes (ready for integration)
- [x] Created `REFACTORING.md` - Documentation for ongoing migration
- [ ] Migrate remaining route groups (coaches, users, observations, etc.)

## Remaining Work / Backlog

### P1 - High Priority  
- [x] Complete "My Development" page for Coaches (DONE)
- [x] Backend refactoring - Phase 1 complete (modules extracted)
- [ ] Backend refactoring - Phase 2 (migrate route groups)
- [ ] Test full end-to-end cloud sync flow on production environment
- [ ] Ensure offline-to-online sync handles conflicts properly
- [ ] Investigate "body stream already read" error in safeFetch.js

### P2 - Medium Priority
- [ ] Session comparison view for coaches
- [ ] Full audit for remaining localStorage usage
- [ ] Production sync failure causing sessions to disappear (carry-over issue)

### P3 - Future
- [ ] Export sessions as PDF reports
- [ ] Email session summaries to coaches
- [ ] Video attachment support
- [ ] Team-level analytics dashboard
- [ ] Improve invite/signup error messages (generic 400 errors)

## Credentials (Preview Environment)
- **Admin:** hello@mycoachdeveloper.com / _mcDeveloper26!
- **Coach Developer:** joemorrisseyg@gmail.com / 12345
- **Coach:** joe_morrissey@hotmail.co.uk / CoachTest123

## 3rd Party Integrations
- **Resend (Email API)** - Requires User API Key
- **recharts** - Charting library for React
- **Stripe** - Payment processing (Test Mode: sk_test_emergent)

## Key Files Reference

### Phase 6 Files (New)
- `/app/frontend/src/pages/CoachMyDevelopment.jsx` - Coach's My Development page
- `/app/frontend/src/pages/CoachCalendar.jsx` - Coach-specific calendar
- `/app/frontend/src/pages/ReviewSession.jsx` - Updated with Activity tab & Analytics module

### Phase 3 Files
- `/app/frontend/src/pages/TemplateManager.jsx` - Main templates page with tabs
- `/app/frontend/src/components/ReflectionTemplatesSection.jsx` - Reflection templates list
- `/app/frontend/src/components/ReflectionTemplateBuilder.jsx` - Template builder
- `/app/frontend/src/lib/reflectionTemplatesApi.js` - API service
- `/app/backend/server.py` - Backend API endpoints (lines 4050-4230)

### Other Key Files
- `/app/frontend/src/contexts/AuthContext.jsx` - Authentication context
- `/app/frontend/src/components/ProtectedRoute.jsx` - Route protection
- `/app/frontend/src/pages/InviteRegistration.jsx` - Invite registration
