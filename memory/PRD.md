# My Coach Developer - Product Requirements Document

## Overview
"My Coach Developer" is a lightweight, iPad-first, offline-capable PWA for coach observations, featuring email/password authentication and distinct roles for "Coach Developer" (admin) and "Coach".

## Recent Updates (March 4, 2026)

### Bug Fixes (March 4, 2026 - Latest Session)

**"Manage Subscription" Modal Fix (COMPLETED - March 4, 2026)**
- User reported the subscription modal was showing old, incorrect tier information
- Fixed backend endpoint `/api/pricing/tiers` to dynamically generate tiers from `subscription_config.py`
- Updated frontend `UpgradeModal.jsx` to parse and render the new data structure
- Modal now correctly displays three new tiers: Individual Coach (£50/year), Coach Developer (£150/year), Club (£600/year)
- Features displayed per tier: Coach Developers, Coaches limit, Observations/Coach
- Monthly/Annual toggle working with "2 months free" badge
- Verified working via screenshot testing

**Admin Tier Change 400 Error Fix (COMPLETED - March 4, 2026)**
- User reported changing org tier in Admin Dashboard failed with status 400
- Root cause: Backend endpoint `/api/admin/organizations/{org_id}/tier` only accepted old tier keys (`individual`, `developer`, `club`)
- Frontend was sending new tier keys (`individual_coach`, `coach_developer`, `club`) after Phase 5 update
- Fixed backend to accept both new and legacy tier keys
- Now also sets `current_tier_key` and `is_legacy_tier` fields for proper tier tracking
- Verified working via curl testing

**Admin Tier Change Not Reflecting in User Account (COMPLETED - March 4, 2026)**
- User reported that after changing tier in Admin Dashboard, the user account still showed the old tier
- Root cause: Admin tier change only updated `organizations` collection, but `resolve_organization_entitlements()` reads from `subscriptions` collection first
- Fixed: Admin tier change now updates BOTH `organizations` AND `subscriptions` collections
- If no subscription record exists, it creates one with the new tier
- Verified working via API testing - entitlements now correctly reflect admin-changed tier

**CRITICAL: Data Isolation Bug - Invites Visible Across Organizations (COMPLETED - March 4, 2026)**
- User reported seeing pending invites from other organizations (e.g., QPR invites visible in Effra Football Club)
- Root cause: `/api/invites` endpoint was returning ALL pending invites without filtering by organization_id
- Fixed invites routes (`/app/backend/routes/invites.py`):
  - `POST /invites` - Now stores `organization_id` when creating invites
  - `GET /invites` - Now filters by user's organization_id
  - `DELETE /invites/{invite_id}` - Now only allows deleting invites from own organization
  - `DELETE /invites/by-email/{email}` - Now only deletes invites from own organization
- Legacy invites (without org_id) fallback to `invited_by` user check for backwards compatibility

**CRITICAL: Template Organization Isolation Hardening (COMPLETED - March 4, 2026)**
- Strengthened organization isolation for observation and reflection templates
- Observation templates (`/api/observation-templates`):
  - PUT and DELETE now verify template belongs to user's organization
- Reflection templates (`/api/reflection-templates`):
  - PUT, DELETE, and set-default now verify template belongs to user's organization
  - Removed `created_by` check in favor of organization membership check
- Templates can only be modified/deleted by users in the same organization

**iOS Safe Area / Dynamic Island Header Fix (COMPLETED - March 4, 2026)**
- User reported header being blocked by iOS status bar and Dynamic Island on iPhones
- Fixed landing page header: Added `safe-area-top` class for proper top padding
- Fixed app header: Already had `safe-area-top` class, improved styling
- Fixed mobile menu (Sheet component): Added safe area padding to top and bottom
- Updated CSS safe area classes to have minimum 12px padding
- Increased hero section top padding on mobile (pt-36 vs pt-32)
- Verified working via mobile viewport screenshot testing

**Profile Photo Not Syncing Across Pages (COMPLETED - March 4, 2026)**
- User reported profile photo showed in Team Members list but not in "Your Account" section at top of Settings
- Also not showing in "My Development" page after upload
- Root cause: Auth context (`user.picture`) wasn't being updated when photo was uploaded
- Fixed: Added `updateUser()` function to AuthContext to allow updating user data
- Updated UserSettings.jsx and CoachMyDevelopment.jsx to call `updateUser({ picture: photoData })` after upload
- Now photo syncs immediately across all pages without requiring page refresh
- Verified: Settings page shows same photo in both "Your Account" and "Team Members" sections
- Verified: My Development page shows photo correctly

**Observation Template Session Parts Showing Generic Names on Mobile (COMPLETED - March 4, 2026)**
- User reported observation on phone showed "Part 1, Part 2" instead of custom names like "Develop winning technique"
- Root cause: When API call failed or was slow on mobile, app fell back to localStorage templates which had generic part names
- Fixes applied:
  1. SessionSetup.jsx: Only fall back to localStorage when truly offline (`!navigator.onLine`), not on API errors
  2. storage.js: Removed generic "Part 1, Part 2" from default session parts (now empty array)
  3. sessionPartsApi.js: Removed generic fallback session parts (now empty array)
  4. observationTemplatesApi.js: Clear session parts cache when templates are created/updated
- This ensures mobile users always get fresh template data from the server when online

**Ball State Timeline on Session Analysis Page (COMPLETED - March 9, 2026)**
- User requested a thin timeline showing ball state (rolling/stopped) below the intervention timeline
- Features implemented:
  1. Added thin ball state timeline below intervention timeline with clickable segments
  2. Colors: Rolling = #B8E0A5 (soft green), Stopped = #E5E7EB (light grey)
  3. Hover tooltip shows duration of each segment (e.g., "Rolling: 2m 30s")
  4. Click to filter: Click green segment = only show interventions when ball rolling, click grey = only stopped
  5. Active filter shows with a ring highlight on the segment and a clear (X) button
  6. Legend updated to show rolling/stopped as clickable filter buttons
  7. Main timeline background also updated to use the same consistent colors
- Bug fix (March 9, 2026): Timeline was showing all grey because the ball_rolling_log data format is state changes (timestamps when ball state changed), not pre-calculated segments. Added `getBallRollingSegments()` function to convert state change log into displayable segments with start/duration/rolling.
- Implementation: Updated ReviewSession.jsx with new `ballStateFilter` state, `getEventBallState()` helper function, `getBallRollingSegments()` converter function, and modified `getFilteredEvents()` to support ball state filtering

### Earlier Bug Fixes (March 4, 2026)

**Demo Account Subscription Fix (COMPLETED)**
- Created `/app/backend/scripts/bootstrap_demo_subscriptions.py` to assign active subscriptions to demo accounts
- Fixed demo accounts that were showing "Subscription Required" modal incorrectly
- All demo accounts now have proper subscription records in the database:
  - `demo.coachdeveloper@mycoachdeveloper.com` - Coach Developer tier
  - `demo.individualcoach@mycoachdeveloper.com` - Individual Coach tier  
  - Riverside Football Academy (all users) - Club tier with password `Demo123!`

**Navigation Tier-Based Filtering (COMPLETED)**
- Updated `AppHeader.jsx` to show/hide navigation based on subscription tier
- Individual Coach tier: "My Coaches" hidden, "My Development" visible
- Coach Developer/Club tiers: "My Coaches" visible, "My Development" hidden (for now)
- Added subscription tier fetching in AppHeader via `/api/subscriptions/limits-summary`

**Reflection Templates Tier-Based Filtering (COMPLETED)**
- Updated `ReflectionTemplatesSection.jsx` to only show "Coaches" reflection templates for Individual Coach tier
- Individual Coach tier users don't see "Coach Developers" reflection tab
- Updated `SessionSetup.jsx` to hide "Observer Reflection Template" selector for Individual Coach tier
- Individual Coach users only see "Coach Reflection Template" when setting up observations

**My Development Route Access (COMPLETED)**  
- Updated `ProtectedRoute.jsx` with new `allowCoachDeveloper` prop
- `/coach/development` route now allows both `coach` and `coach_developer` roles
- Individual Coach users can now access their development page

**Settings Page Subscription Badge Fix (COMPLETED)**
- Updated `UserSettings.jsx` to use `limits.tier_key` and `limits.tier_name` from limits API
- Badge now correctly displays "Individual Coach", "Coach Developer", or "Club" 
- Removed dependency on legacy `subscriptionTier` state that showed "Individual Plan"

### Subscription Restructure Project (In Progress)

**Phase 1: Data Model & Entitlement System (COMPLETED)**
- New subscription tiers: `individual_coach`, `coach_developer`, `club`
- Entitlement resolution engine in `backend/subscription_config.py`
- Legacy tier mapping for safe migration
- API endpoints: `/api/subscriptions/tiers`, `/api/subscriptions/entitlements`

**Phase 2: Stripe Plan Mapping (COMPLETED - March 4, 2026)**
- Stripe price configuration structure for new tiers
- Placeholder price IDs for `individual_coach` and `coach_developer` (to be filled after Stripe setup)
- Club tier reuses existing Stripe price IDs
- Migration helper functions for subscription documents
- New migration fields: `current_tier_key`, `is_legacy_tier`, `legacy_tier_key`, `current_period_end`, `pending_tier_key`
- New API endpoints:
  - `GET /api/subscriptions/stripe/config` - View Stripe price configuration
  - `GET /api/subscriptions/available-tiers` - Tiers available for signup
  - `GET /api/subscriptions/pricing-comparison` - Pricing page data
  - `GET /api/subscriptions/migration/check/{org_id}` - Check migration status
  - `POST /api/subscriptions/migration/apply/{org_id}` - Apply migration fields
  - `GET /api/subscriptions/migration/bulk-status` - Migration dashboard data
  - `PUT /api/subscriptions/admin/stripe/price` - Set Stripe price IDs

**Phase 3: Backend Enforcement of Limits (COMPLETED - March 4, 2026)**
- Observation limit enforcement when completing sessions
- Only enforced when status changes TO "completed" (not for draft/active/planned)
- Per-coach observation counting (10 per coach for Coach Developer tier)
- Limit check functions in `backend/dependencies.py`:
  - `check_observation_limit_for_coach()` - Check if observation is allowed
  - `enforce_observation_limit_on_completion()` - Enforce during session completion
  - `get_limits_summary_for_user()` - Get complete limits overview
- New API endpoint:
  - `GET /api/subscriptions/limits-summary` - Complete limits dashboard for frontend
- Modified routes:
  - `POST /api/observations` - Now checks limits before completing
  - `PUT /api/observations/{session_id}` - Now checks limits before completing

**Phase 4: Observation Flow UI Updates (COMPLETED - March 4, 2026)**
- Created `frontend/src/lib/subscriptionApi.js` - Frontend API for subscription limits
- Updated `SessionSetup.jsx` with observation limit display:
  - Fetches observation limits for all coaches when page loads
  - Shows observation count (e.g., "3/10") next to each coach in dropdown
  - Displays warning when coach is approaching limit (2 observations remaining)
  - Shows error alert when coach has reached limit
  - Prevents starting observation when limit reached
  - Coaches at limit are disabled in the dropdown

**Phase 5: UI Limits Visibility & Admin Controls (COMPLETED - March 4, 2026)**
- Enhanced `UserSettings.jsx` subscription usage display:
  - Shows tier name and legacy status badge
  - Added Observations/Coach limit display
  - Shows features badges (Unlimited History, Data Retention, Self Observation)
  - Loading state for subscription info
- Updated `AdminDashboard.jsx` with new tier system:
  - Updated tier options to include new tiers (individual_coach, coach_developer, club)
  - Added legacy tier display (individual, developer)
  - 4-column limit editing form including Observations/Coach field
  - Admin can now set custom observation limits per organization (0 = unlimited)
- Admin endpoint `PUT /api/subscriptions/admin/organization/{org_id}/limits` supports observation limits

**Phase 6: Landing Page Pricing Update (COMPLETED - March 4, 2026)**
- Updated `LandingPage.jsx` with new pricing structure:
  - New default tiers: Individual Coach (£5/mo), Coach Developer (£15/mo), Club (£60/mo)
  - Fetches live pricing from `/api/subscriptions/pricing-comparison` endpoint
  - Shows observation limits per tier (e.g., "10/coach" or "Unlimited")
  - Feature list with checkmarks for each tier
  - All tiers now have Stripe price IDs configured
- Updated `server.py` STRIPE_PRODUCTS to include new tier mappings:
  - `individual_coach` and `coach_developer` with actual Stripe price IDs
  - All tiers ready for Stripe checkout

**Phase 7: Migration Logic for Legacy Users (COMPLETED - March 4, 2026)**
- Created `MigrationBanner.jsx` component for legacy user notification:
  - Shows banner on Settings page for users on legacy tiers
  - Displays migration details with old/new tier comparison
  - "Migrate Now" button for early voluntary migration
  - Dismissible banner UI
- New backend API endpoints:
  - `GET /api/subscriptions/my-migration-status` - Get current user's migration status
  - `POST /api/subscriptions/migrate-early` - Voluntary early migration
  - `POST /api/subscriptions/migration/bulk-apply` - Admin: Apply migration fields to all legacy subs
  - `POST /api/subscriptions/migration/complete/{org_id}` - Admin: Complete migration for specific org
- Frontend API functions in `subscriptionApi.js`:
  - `fetchMigrationStatus()` - Get migration status with caching
  - `migrateEarly()` - Trigger early migration
  - `clearSubscriptionCaches()` - Clear all subscription caches

**🎉 ALL 7 PHASES COMPLETED!**

### New Subscription Tiers

| Tier | Monthly | Annual | Coach Devs | Coaches | Obs/Coach |
|------|---------|--------|------------|---------|-----------|
| Individual Coach | £5 | £50 | 1 | 0 (self only) | Unlimited |
| Coach Developer | £15 | £150 | 1 | Unlimited | 10 |
| Club | £60 | £600 | 5 | 30 | Unlimited |

### Post-Session Editing - Session Parts Timeline (March 2, 2026)
- **Draggable Part Timing**: Coach Developers can edit completed session parts by dragging edge handles on the visual timeline
- **Start/End Time Adjustment**: Drag left edge to change start time, drag right edge to change end time
- **Minimum Duration**: Parts enforce 1-minute minimum duration to prevent accidental deletion
- **Real-time Visual Updates**: Timeline proportions update instantly during drag operations
- **Separation of Concerns**: Ball rolling times are edited in the Ball Rolling Timeline section only; Session Parts section focuses on part timing only
- **Persistent Changes**: All edits save to database and affect coach profiles/analytics
- **Features**: Add inactive parts, remove parts, reorder via drag-and-drop, edit part names

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


### Subscription Cancellation & Entitlement (NEW - Feb 27, 2026)
- **Cancellation does NOT block login** - Authentication is separate from entitlement
- **Grace period during paid billing cycle** - If user cancels but billing period hasn't ended:
  - Full app access continues until `currentPeriodEnd`
  - No blocking modal shown
- **Post-period cancellation blocking:**
  - User can still log in
  - App shows non-dismissible subscription modal
  - Modal cannot be closed (no X, no escape, no click-outside)
  - User must either select a plan or log out
- **Entitlement rules (is_entitled = true):**
  - `status = 'active'` or `status = 'trialing'`
  - `cancel_at_period_end = true` AND `current_time < currentPeriodEnd`
- **Entitlement rules (is_entitled = false):**
  - No subscription exists
  - `status = 'canceled'` AND `current_time >= currentPeriodEnd`
  - `status in ['unpaid', 'incomplete', 'incomplete_expired', 'past_due']`
- **Admin users bypass entitlement check**
- **API Endpoint:** `GET /api/billing/entitlement` returns:
  - `is_entitled`, `subscription_status`, `cancel_at_period_end`, `current_period_end`, `active_tier`, `reason`, `server_time`


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

#### observation_templates Collection (NEW - Feb 24, 2026)
```
{
  template_id: string,
  name: string,
  description: string (optional),
  observation_context: "training" | "game",
  intervention_types: [
    { id: string, name: string, color: string }
  ],
  descriptor_group1: {
    id: string, name: string, color: string,
    descriptors: [{ id: string, name: string }]
  },
  descriptor_group2: {
    id: string, name: string, color: string,
    descriptors: [{ id: string, name: string }]
  },
  session_parts: [
    { id: string, name: string, order: number, isDefault: boolean }
  ],
  is_default: boolean,
  organization_id: string,
  created_by: string,
  created_at: string,
  updated_at: string
}
```

**Default Templates (Bootstrapped at Signup):**
- **Training Template:** Parts = "Part 1", "Part 2", "Part 3", "Part 4"
- **Match Day Template:** Parts = "First Half", "Second Half"
- **Coach Educator Reflection:** 5 comprehensive questions
- **Coach Reflection:** 3 simple questions

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

### Phase 19: Default Templates System (COMPLETED - February 24, 2026)
- [x] **Observation Window Templates**
  - Training Template: Parts = "Part 1", "Part 2", "Part 3", "Part 4"
  - Match Day Template: Parts = "First Half", "Second Half" (only 2 parts)
  - Both templates share same intervention types and descriptor groups
- [x] **Reflection Templates**
  - Coach Educator Reflection: 5 comprehensive questions (for coach developers)
  - Coach Reflection: 3 simple questions (for coaches)
- [x] **Auto-bootstrap on signup:** Templates automatically created for every new organization
- [x] **Full CRUD API endpoints** for observation templates
- [x] **Users can customize:** After creation, templates are fully editable

### Phase 20: Template-Based Session Parts (COMPLETED - February 24, 2026)
- [x] **Template Part Names Persist:**
  - When user edits session part names in a template, changes are saved to the backend
  - Updated names become the new defaults for that template
  - No fallback to legacy default names
- [x] **Session Setup Uses Selected Template:**
  - Session Setup page has "Start from Template" dropdown
  - Selecting a template applies its session parts to the new session
  - No mixing of old and new part names
- [x] **Template Isolation:**
  - Editing one template does not affect other templates
  - Each template maintains its own session parts
- [x] **Session History Preserved:**
  - Previously created sessions retain their original part names
  - Changes only apply to future sessions

### Settings Page Restructure (COMPLETED - February 24, 2026)
- [x] Removed "Admin" tab
- [x] Removed "Invites" tab
- [x] Moved "Subscription Management" to "Club" tab
- [x] Moved "Invite New User" to collapsible section in "Users" tab (at top)
- [x] Only 2 tabs remain: "Users" and "Club"

### Phase 21: Critical Data Isolation Bug Fix (COMPLETED - February 25, 2026)
- [x] **Fixed /api/coaches endpoint** - Now filters by organization_id to prevent cross-org data leakage
- [x] **Added organization_id to coach profiles** - All coach creation paths now include organization_id
- [x] **Migration for existing data** - Backfilled organization_id for existing coach profiles from linked users
- [x] **Verified complete data isolation:**
  - org_demo_0725dd5e668a sees only its 10 coaches
  - org_4b76a7344640 sees only its 1 coach  
  - org_5f00565686b5 sees 0 coaches (no coach profiles in that org)
- [x] **No cross-organization data leakage** - 100% test pass rate

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
- [ ] Note position on timeline is incorrect (P1)
- [ ] Production password reset email delays (P2)
- [ ] "Body stream already read" console error (P3)

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

## Recent Updates (Feb 26, 2026)

### Bug Fixes
1. **Subscription Update Bug (P0 - FIXED)** - Upgrading/downgrading plans was creating duplicate Stripe subscriptions instead of modifying existing ones. Fixed by changing frontend `UpgradeModal.jsx` to call `/api/payments/update-subscription` instead of `/api/payments/checkout` for plan changes.

2. **401 Unauthorized Bug (P0 - FIXED)** - Coach profile pages and exit-impersonation returned 401 errors when navigating between views. Fixed by adding `getAxiosConfig()` helper function to include `Authorization: Bearer` header in all axios/fetch calls across:
   - `/app/frontend/src/pages/CoachProfile.jsx`
   - `/app/frontend/src/components/coach/CoachNotes.jsx`
   - `/app/frontend/src/pages/ReviewSession.jsx`
   - `/app/frontend/src/components/AppHeader.jsx` (exit-impersonation)
   - `/app/frontend/src/lib/offlineSync.js`

3. **Exit Impersonation 401 Bug (P0 - FIXED)** - Admin users were getting logged out when exiting impersonation mode. Fixed by:
   - Updating frontend `AppHeader.jsx` to include Authorization header in exit-impersonation API call
   - Updating backend `server.py` to accept Authorization header for both `/api/admin/impersonate/{user_id}` and `/api/admin/exit-impersonation` endpoints

### Files Modified
- `/app/frontend/src/components/UpgradeModal.jsx` - `handlePlanChange()` now uses update endpoint
- `/app/frontend/src/pages/CoachProfile.jsx` - Added auth token to all API calls
- `/app/frontend/src/components/coach/CoachNotes.jsx` - Added auth token to all API calls
- `/app/frontend/src/pages/ReviewSession.jsx` - Added auth token to all API calls

## 3rd Party Integrations
- **Resend (Email API)** - Requires User API Key
- **recharts** - Charting library for React
- **Stripe** - Payment processing (Test Mode: sk_test_emergent)

## Mobile Responsiveness (March 1, 2026)

### AppHeader - Responsive Navigation
- **Hamburger menu** visible on mobile (<768px viewport)
- **Full navigation** visible on tablet/desktop (≥768px viewport)
- **Side drawer (Sheet)** opens from right with:
  - Navigation items (Home, My Coaches, Templates, Calendar, Settings)
  - Sync status indicator
  - User info (logged in as...)
  - Log out button

### Page-Specific Responsive Updates
- **ReviewSession.jsx**: Compact header buttons (CSV icon-only, PDF icon-only on mobile)
- **SessionSetup.jsx**: "Start" on mobile, "Start Observation" on desktop
- **MyCoaches.jsx**: "+" button on mobile, "Add Coach" on desktop
- **CoachProfile.jsx**: Play icon on mobile, "New Observation" on desktop
- **LiveObservation.jsx**: Compact bottom panel, smaller badges on mobile
- **TemplateManager.jsx**: Smaller tabs and padding on mobile

### Breakpoints Used
- `sm:` (640px) - For button text and minor sizing
- `md:` (768px) - For navigation switch (hamburger vs full nav)
- `lg:` (1024px) - For grid layouts

## Mobile Gestures (March 1, 2026)

### Swipe Navigation
- **Main App Pages**: Swipe left/right to navigate between Home ↔ Coaches ↔ Templates ↔ Calendar ↔ Settings
- **Session Review Tabs**: Swipe left/right to switch between Summary ↔ Reflections ↔ Analysis tabs
- **Visual Indicators**: Shows page name during swipe gesture with slide-in animation
- **Mobile Only**: Swipe features only active on viewports < 768px
- **Navigation Dots**: REMOVED per user request (coaches don't scroll through app)

### Pull-to-Refresh
- **Enabled Pages**: Home, My Coaches, Calendar, Coach Profile
- **Visual States**: Pull → Release → Refreshing → Success
- **Offline Indicator**: Shows "Offline - showing cached data" when not connected
- **Resistance**: Natural pull resistance for smooth UX

### PWA Safe Area Support (iOS)
- **Safe Area Insets**: CSS env() variables for top/bottom/left/right safe areas
- **Standalone Mode**: Extra top padding when app runs without browser chrome
- **Header Support**: AppHeader includes safe-area-top class for status bar clearance

### Implementation Files
- `/app/frontend/src/hooks/useSwipeNavigation.js` - Swipe detection hooks
- `/app/frontend/src/components/PullToRefresh.jsx` - Pull-to-refresh component  
- `/app/frontend/src/components/SwipeablePageWrapper.jsx` - Page wrapper with swipe
- `/app/frontend/src/App.css` - Safe area CSS utilities

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


## Post-Session Editing (March 2, 2026)

### Edit Session Feature
- **Access**: Only Coach Developers can edit completed sessions
- **Button**: "Edit Session" button in session review header (orange with pencil icon)
- **Tracking**: "Last edited: [date] by [user]" indicator displayed in header

### Session Times Editor
- Edit Start Time with datetime picker
- Edit End Time with datetime picker
- Total Duration auto-calculated
- Validation prevents end time before start time

### Ball Rolling Timeline Editor
- Visual timeline with draggable divider
- Green segment for ball rolling, red for not rolling
- Drag handle between segments to adjust times
- Touch support for mobile devices
- Legend positioned BELOW timeline (not overlaid)
- Real-time time display: "Rolling: MM:SS / Not Rolling: MM:SS"

### Session Parts Timeline Editor
- Visual timeline showing all session parts with colors
- Add new parts via "Add Part" button and dialog
- Edit part names inline (click edit icon)
- Delete parts with confirmation dialog
- Drag-and-drop reordering
- Parts auto-distribute across session duration

### Interventions Editor
- Visual timeline showing event markers
- Edit event timestamp (MM:SS format)
- Change intervention type via dropdown
- Edit descriptors (click to toggle)
- Remove interventions with confirmation dialog
- Edit session part assignment

### Offline Caching (24-hour validity)
- All scheduled sessions cached on app load
- Sessions available when offline
- Cache refreshes after 24 hours or on reconnection
- Implementation: `/app/frontend/src/lib/scheduledSessionsCache.js`

### Implementation Files
- `/app/frontend/src/components/SessionEditTimeline.jsx` - Main editor component
- `/app/backend/routes/observations.py` - Backend with edit tracking
