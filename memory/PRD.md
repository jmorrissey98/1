# My Coach Developer - PRD

## Original Problem Statement
A coaching observation platform (MyCoachDeveloper) for sports coaching development with multi-tenancy, session management, template management, subscription tiers, and admin capabilities.

## Core Features (Implemented)
- Multi-tenant coaching observation platform
- Session recording with events, ball rolling tracking, and timeline
- Observation templates (Training/Match Day) with configurable parts
- Reflection templates for observers and coaches (text, scale, checkbox questions)
- Admin dashboard with organization management and impersonation
- Role-based access (Admin, Coach Developer, Coach)
- Free trial with subscription tiers (Stripe integration)
- Landing page, signup, login flows
- CSV/PDF export of sessions
- Coach profiles with analytics (intervention patterns, variety score, ball rolling balance)
- Admin template system (global/bootstrap defaults for new organizations)
- Data isolation (organization_id filtering on all queries)
- Trial Extension for Admins (extend/grant trials from Admin Dashboard)
- Stripe subscription price auto-sync on admin tier changes and user early migrations

## Architecture
- **Frontend**: React (CRA) with Shadcn/UI, Recharts
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Auth**: Session-based with cookies
- **Integrations**: Stripe, Resend (email), Google Analytics, OpenAI Whisper

## Key Technical Decisions
- `total_duration`, `ball_rolling_time` stored in SECONDS (frontend `formatTime()` expects seconds)
- Events `relativeTimestamp` and `ball_rolling_log` entries stored in MILLISECONDS
- Admin templates (prefix `admin_tpl_`) serve as global defaults for all organizations
- Session data strictly filtered by `organization_id` for multi-tenancy
- Stripe subscription modifications filter out demo (`sub_demo_`) and trial (`sub_trial_`) subscription IDs
- **Subscription priority**: When multiple subscription docs exist for an org (e.g. expired trial + active paid), active non-trial subscriptions take precedence

## What's Been Implemented (Chronological)
- Full coaching observation platform with session recording
- Admin template system overhaul (merged system defaults into admin templates)
- Critical data leak fix (organization_id filtering)
- Mandatory organization name on signup
- Session analysis UI fixes (pie charts, tooltips)
- Role-based notes visibility (observer notes hidden from coaches)
- Reflection form "Edit" mode
- Template deletion permission fixes
- **[March 2026]** Riverside Football Academy demo data seeding (36 sessions, 10 coaches)
- **[March 2026]** Fixed reflection crash (response type mismatch with template question types)
- **[March 2026]** Fixed impersonation data leak (localStorage fallback showing stale cross-org sessions)
- **[July 2026]** Admin Trial Extension feature (extend/grant trials, UI + backend)
- **[July 2026]** Fixed admin org list missing trial fields in MongoDB projection
- **[July 2026]** Stripe subscription price auto-update on admin tier change & user early migration
- **[August 2026]** CRITICAL FIX: Trial-to-paid subscription entitlement bug. Users who subscribed after trial still saw "trial expired". Root cause: checkout webhook created a new subscription doc while old trial doc remained; find_one() returned the stale trial doc. Fixed with subscription priority logic across entitlement check, admin org list, and webhook cleanup.

## Pending Issues
1. **P2 - Production Sync Failure**: Long-standing infrastructure issue
2. **P2 - Unoptimized DB Queries**: Performance optimization needed

## Upcoming Tasks
1. **P1 - Free Trial Emails**: Implement Trial Started, Expiring Soon, Expired notifications via Resend
2. **P2 - Refactor ReviewSession.jsx**: Break 3000+ line component into smaller components
3. **P2 - Full E2E Verification**: Complete platform testing
4. **P3 - Refactor server.py**: Split admin routes into dedicated route files (6300+ lines)

## Key Files
- `/app/backend/routes/observations.py` - Session CRUD with org_id filtering
- `/app/backend/routes/subscriptions.py` - Stripe tier management, early migration with Stripe sync
- `/app/backend/server.py` - Main backend with admin endpoints, entitlement check, Stripe webhooks
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin dashboard with trial extension UI
- `/app/frontend/src/pages/HomePage.jsx` - Session list (fixed localStorage fallback)
- `/app/frontend/src/pages/ReviewSession.jsx` - Session review (3000+ lines, needs refactor)
- `/app/backend/scripts/seed_riverside_demo.py` - Demo data seed script

## Test Credentials
- **Admin**: hello@mycoachdeveloper.com / _mcDeveloper26!
- **Demo Coach Dev**: sarah.mitchell@demo.mycoachdeveloper.com / Demo123!
- **Demo Coach**: michael.thompson@demo.mycoachdeveloper.com / Demo123!
