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

### Landing Page (Updated Feb 23, 2026)
- **Hero:** "Develop Your Coaches. Simple." (Simple in blue)
- **Body text:** "Keep your focus where it matters: developing your coaches. Observe sessions, build portfolios, and support progress with ease."
- **Features:**
  - Observe Sessions - Capture coaching moments in real time
  - Build Coach Portfolios - Bring together observations, notes, evidence
  - Support Development - Turn observations into development plans
- **Pricing tiers:**
  - Individual: £20/month, 5 coaches, 1 admin, **3 months data history**
  - Developer: £35/month, 10 coaches, 1 admin, **Unlimited data history** (Most Popular)
  - Club: £60/month, 50 coaches, 10 admins, **Unlimited data history**
- **Billing:** Monthly default, Annual shows "2 months free" badge

### Data Retention (NEW - Feb 23, 2026)
- **Individual plan:** Rolling 3-month data window (data older than 3 months is hidden but preserved)
- **Developer/Club plans:** Unlimited data history
- **Upgrade behavior:** When Individual users upgrade, all historical data immediately becomes accessible
- **Upgrade prompt:** Yellow banner shown when hidden sessions exist, links to settings/subscription
- **Implementation:**
  - Backend filters sessions by `created_at >= cutoff_date` for Individual tier
  - `data_retention` object returned with session/analytics API responses
  - Hidden session count tracked for upgrade messaging

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

### Admin Features (Updated Feb 23, 2026)
- **Archive/Reinstate Organizations** - Soft delete clubs moving them to "Archived" status, with ability to reinstate
- **Organization Status Filter** - Toggle to show/hide archived organizations
- **Visual Limits Display** - Badges showing coach count, developer limit, and data retention per organization
- **Edit Subscription Tiers** - Modify global tier properties (price, limits) 
- **Manual Tier Changes** - Dropdown to change organization subscription tier (Individual/Developer/Club)
- **Per-Organization Limit Overrides** - Set custom limits for individual clubs
- **Impersonate Users** - View app as any non-admin user for debugging (exit returns to admin dashboard)
- **Send Password Reset Email** - Admin can force-send reset email to any user (bypasses OAuth check, 24hr validity)
- **Direct Password Set** - Admin can directly set a new password for any user
- Add coach developers to clubs directly
- View all clubs and users

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
- `GET /api/coaches/{coach_id}/analytics` - Get aggregated analytics for a specific coach (NEW)
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

### Observation Window Templates (NEW - Feb 24, 2026)
- `GET /api/observation-templates` - List all observation templates
- `GET /api/observation-templates/{template_id}` - Get template details
- `GET /api/observation-templates/default/{context}` - Get default template for context (training/game)
- `POST /api/observation-templates` - Create template
- `PUT /api/observation-templates/{template_id}` - Update template
- `DELETE /api/observation-templates/{template_id}` - Delete template
- `POST /api/observation-templates/{template_id}/set-default` - Set as default

### Other
- `GET /api/organization` - Get club branding
- `PUT /api/organization` - Update club branding
- `GET /api/session-parts` - Get session part templates

### Admin Endpoints (Updated Feb 23, 2026)
- `GET /api/admin/organizations` - List all organizations (include_archived query param)
- `GET /api/admin/organizations/{org_id}/users` - List users in organization
- `GET /api/admin/organizations/{org_id}/limits` - Get organization limits
- `PUT /api/admin/organizations/{org_id}/limits` - Set custom limit overrides
- `POST /api/admin/organizations/{org_id}/archive` - Archive organization (soft delete)
- `POST /api/admin/organizations/{org_id}/reinstate` - Reinstate archived organization
- `DELETE /api/admin/organizations/{org_id}` - Permanently delete organization
- `GET /api/admin/subscription-tiers` - Get all subscription tiers
- `PUT /api/admin/subscription-tiers/{tier_id}` - Update subscription tier
- `POST /api/admin/impersonate/{user_id}` - Start impersonating user
- `POST /api/admin/exit-impersonation` - Exit impersonation mode (returns admin_token)

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

### Phase 8: Coach Experience Enhancements (COMPLETED - February 17, 2026)
- [x] **Full Session Access for Coaches**
  - Updated /session/:sessionId/review route to allow coaches (not just coach developers)
  - Updated /api/observations/{session_id} endpoint to allow coaches to fetch their assigned sessions
  - Coaches see full observation data: summary, events, interventions, charts, analytics
  - Same UI as coach developer view but permission-limited
- [x] **Reflection Permissions (Updated)**
  - Observer's Notes and Additional Notes now HIDDEN from coaches (only formal reflections visible)
  - Coaches can add their own reflections via Coach Reflections section
  - Coaches cannot see/edit/delete observer content
- [x] **My Coaching Tab Redesigned**
  - Removed Overview tab completely - now 3 tabs: My Coaching, My Sessions, My Targets
  - My Coaching shows: Profile, Sessions Observed, Active Targets (removed Targets Achieved)
  - Added new analytics metrics:
    - Avg Ball Rolling percentage
    - Avg Interventions per Session
    - Total Interventions
    - Intervention Distribution horizontal bar chart
    - Intervention Patterns card (Most Used, Variety Score, Ball Rolling Balance)
  - New /api/coach/analytics endpoint for aggregated analytics data
- [x] **Post-Observation Reflection Flow**
  - Action-focused prompt on My Development page when reflection pending
  - Sessions needing reflection appear first in My Sessions (blue styling)
  - "Add Reflection" button visible for sessions without coach reflection

### Previous Work
- Stripe checkout integration
- Landing page with pricing
- Signup loophole closed
- White screen crash fixed
- Cloud sync for observation sessions
- Admin dashboard with impersonation
- Token-based authentication

### Phase 9: Backend Refactoring (COMPLETED - February 17, 2026)
- [x] Created `database.py` - Database connection and configuration
- [x] Created `models.py` - All Pydantic models (~400 lines extracted)
- [x] Created `dependencies.py` - Auth middleware (require_auth, require_admin, etc.)
- [x] Created `utils.py` - Utility functions (password hashing, email sending)
- [x] Created `routes/auth.py` - Authentication routes ✅ INTEGRATED
- [x] Created `routes/coaches.py` - Coach CRUD routes ✅ INTEGRATED
- [x] Created `REFACTORING.md` - Documentation for ongoing migration
- [x] Created `routes/invites.py` - Invite management routes ✅ INTEGRATED
- [x] Created `routes/users.py` - User management routes ✅ INTEGRATED
- [x] Created `routes/observations.py` - Observation session CRUD ✅ INTEGRATED
- [x] Created `routes/organization.py` - Organization/Club management ✅ INTEGRATED
- [x] Removed duplicate inline routes from server.py
- **Result**: server.py reduced from ~4800 lines to ~2900 lines (39% reduction)

### Phase 10: Coach Dashboard UI/UX Refinements (COMPLETED - February 17, 2026)
- [x] Home button now navigates to Coach Dashboard (/coach/dashboard) not My Development
- [x] Changed notification dot color from blue to GREEN on My Sessions tab
- [x] 3-column metrics row: Sessions Observed, Avg Ball Rolling, Avg Interventions (same row)
- [x] Intervention Distribution filter toggles (checkboxes to show/hide interventions in chart)
- [x] Archived targets section collapsed by default with expand/collapse toggle
- [x] Added delete button for archived targets (in addition to restore)

### Phase 11: Legal Pages (COMPLETED - February 17, 2026)
- [x] Created Terms of Service page (`/terms-of-service`)
- [x] Created Privacy Policy page (`/privacy-policy`)
- [x] Created Commercial Terms page (`/commercial-terms`)
- [x] Created Data Processing Summary page (`/data-processing`)
- [x] Added links to all 4 legal pages in the landing page footer

### Phase 12: Stripe Live Integration (COMPLETED - February 18, 2026)
- [x] Configured live Stripe API keys (publishable and secret)
- [x] Integrated 3 product IDs:
  - Individual Plan: prod_TzxFEJM4rt7UyV
  - Developer Plan: prod_TzxEC0P2ychhee
  - Club Plan: prod_TzxE3SVtpPojK3
- [x] Updated checkout endpoint to use Stripe's native subscription API
- [x] Checkout dynamically fetches monthly/annual prices from Stripe
- [x] Webhook handling for subscription events (created, updated, canceled)
- [x] Subscription records stored in database with tier limits

### Phase 13: Subscription Limit Enforcement (COMPLETED - February 18, 2026)
- [x] **Backend Subscription Checks**
  - Added `check_coach_limit()` and `check_admin_limit()` helper functions in `dependencies.py`
  - Protected `POST /api/coaches` with coach limit check (returns 403 if exceeded)
  - Protected `POST /api/invites` with role-based limit check (403 if coach/admin limit exceeded)
  - New endpoint: `GET /api/organization/limits` - Returns current usage and limits
  - Quick check endpoints: `GET /api/organization/can-add-coach` and `GET /api/organization/can-add-admin`
- [x] **Frontend Coach Limits (MyCoaches.jsx)**
  - Header shows "Coaches: X/Y" with usage count
  - Amber color when limit reached
  - Upgrade button with crown icon when limit exceeded
  - Add Coach button disabled when limit reached
  - Dialog shows slot usage and "Limit reached" badge
- [x] **Frontend Admin Limits (UserSettings.jsx)**
  - New "Subscription Usage" section in Invites tab
  - Shows both Coach (X/Y) and Coach Developer (X/Y) usage
  - Role dropdown shows "(Limit reached)" for unavailable roles
  - Warning messages when selecting a role at limit
  - Send Invite button disabled when selected role's limit reached
  - Upgrade Plan button when any limit exceeded
- [x] **Comprehensive Test Suite**
  - Created `/app/backend/tests/test_subscription_limits.py`
  - Tests for all backend limit endpoints
  - Tests for 403 responses when limits exceeded

### Phase 14: Coach Development Tab Overhaul (COMPLETED - February 20, 2026)
- [x] **Removed "Overview" tab** from CoachProfile.jsx (for coach developer viewing a coach)
- [x] **Coach Development is now default/first tab** with 4 tabs: Coach Development, Profile, Sessions, Reports
- [x] **New backend endpoint:** `GET /api/coaches/{coach_id}/analytics` - Returns analytics data for any coach by ID
- [x] **Coach Profile Card** - Shows coach photo/initials, name, role, and Active Targets count
- [x] **Intervention Patterns Card** - Shows Most Used intervention, Variety Score, Ball Rolling Balance
- [x] **Three Key Metrics Cards** - Sessions Observed, Avg Ball Rolling %, Avg Interventions
- [x] **Intervention Distribution Chart** - Horizontal bar chart with filter checkboxes and collapsible details
- [x] **Development Targets Section** - Add input field, active/achieved targets list
- [x] **Development Trends Section** - AI-generated trends with Generate button
- [x] Layout now matches coach's "My Development" page (CoachMyDevelopment.jsx)

### Phase 16: Coach Profile Notes Feature (COMPLETED - February 23, 2026)
- [x] **Backend API endpoints** for notes CRUD (`/api/coaches/{coach_id}/notes`)
- [x] **CoachNotes.jsx component** - Collapsible card with add/edit/delete notes
- [x] **Privacy controls** - Toggle between private and shared notes
- [x] **Role-based visibility** - Coach developers see all notes; coaches see shared + own private
- [x] **Integrated into Profile tab** of CoachProfile.jsx (coach developer view)
- [x] **Integrated into My Coaching tab** of CoachMyDevelopment.jsx (coach view)

### Phase 17: Session Filters Bug Fix (COMPLETED - February 23, 2026)
- [x] **Fixed filtering calculations** - Most Used, Variety Score, Ball Rolling Balance now update correctly
- [x] **Intervention Distribution chart** updates based on filtered sessions
- [x] **Pattern analysis** recalculated when filters applied (variety %, most common pattern)
- [x] **Applied fixes to both** CoachProfile.jsx and CoachMyDevelopment.jsx

### Phase 18: Session Filtering Enhancements (COMPLETED - February 23, 2026)
- [x] **Default timeframe by tier** - Individual/free tier users now default to "Last 3 Months" filter
- [x] **Session Parts filter** - Filters analytics to show only data FROM events during selected parts
- [x] **Zero-data display fix** - Metrics now correctly show 0 when filters match no data (instead of total count)
- [x] **Tier-based data enforcement** - Frontend now enforces 3-month limit for Individual tier even before user interacts with filters
- [x] **Ball Rolling fix** - Fixed field name lookup to use `ballRollingTime` (camelCase) from session parts data
- [x] **Session counting fix** - Analytics now count sessions with events or ball rolling time, not just status=completed
- [x] **New helper functions** in SessionFilters.jsx:
  - `filterEventsByParts()` - Filters events by sessionPartId
  - `calculateFilteredAnalytics()` - Recalculates analytics with part-specific filtering
- [x] **Uses nullish coalescing (??)** instead of OR (||) to properly display 0 values

### Phase 15: Shared Reflections Feature (COMPLETED - February 23, 2026)
- [x] **Sharing toggle for Observer (Coach Developer):** "Share with [Coach Name]" - defaults ON
- [x] **Sharing toggle for Coach:** "Share with Coach Developers" - defaults ON
- [x] **Auto-save on toggle:** Sharing settings save immediately when toggled
- [x] **New backend endpoints:**
  - `PUT /api/observations/{session_id}/observer-reflection-sharing` - Toggle observer sharing
  - `PUT /api/observations/{session_id}/coach-reflection-sharing` - Toggle coach sharing
- [x] **Shared Reflections Section:** Each user sees other participant's reflection below their own
- [x] **Placeholder states:**
  - "Reflection not yet completed" when other user hasn't completed reflection
  - "Reflection not shared with you" when completed but sharing is OFF
  - Full reflection content when completed AND shared
- [x] **Access control:** Only session participants can view reflections

## Remaining Work / Backlog

### P1 - High Priority  
- [ ] **Admin impersonation exit flow** - Currently logs admin out completely (workaround); needs proper fix to restore admin session
- [ ] **Note position on session timeline** - Notes should be positioned based on time relative to session start
- [ ] Session comparison view for coaches (compare two sessions side-by-side)
- [ ] Test full end-to-end cloud sync flow on production environment
- [ ] Investigate "body stream already read" error in safeFetch.js
- [ ] Production login failure (needs REACT_APP_BACKEND_URL verification in deployment)
- [ ] Production password reset email delays (needs Resend account/DNS verification)

### P2 - Medium Priority
- [ ] **Production sync failure** causing sessions to disappear (critical data loss bug)
- [ ] Full audit for remaining localStorage usage
- [ ] Ensure offline-to-online sync handles conflicts properly

### P3 - Future
- [ ] Export sessions as PDF reports
- [ ] Email session summaries to coaches
- [ ] Video attachment support
- [ ] Team-level analytics dashboard
- [ ] Improve invite/signup error messages (generic 400 errors)
- [ ] Unoptimized database queries cleanup

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
