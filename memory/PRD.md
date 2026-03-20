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

## Pending Issues
1. **P1 - Legacy Subscription Tier Bug**: New users assigned to incorrect legacy tiers
2. **P2 - Production Sync Failure**: Long-standing infrastructure issue
3. **P2 - Unoptimized DB Queries**: Performance optimization needed

## Upcoming Tasks
1. **P1 - Free Trial Emails**: Implement Trial Started, Expiring Soon, Expired notifications via Resend
2. **P2 - Refactor ReviewSession.jsx**: Break 3000+ line component into smaller components
3. **P2 - Full E2E Verification**: Complete platform testing

## Key Files
- `/app/backend/routes/observations.py` - Session CRUD with org_id filtering
- `/app/backend/server.py` - Main backend with admin endpoints
- `/app/frontend/src/pages/HomePage.jsx` - Session list (fixed localStorage fallback)
- `/app/frontend/src/pages/ReviewSession.jsx` - Session review (3000+ lines, needs refactor)
- `/app/backend/scripts/seed_riverside_demo.py` - Demo data seed script

## Test Credentials
- **Admin**: hello@mycoachdeveloper.com / _mcDeveloper26!
- **Demo Coach Dev**: sarah.mitchell@demo.mycoachdeveloper.com / Demo123!
- **Demo Coach**: michael.thompson@demo.mycoachdeveloper.com / Demo123!
