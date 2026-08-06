# My Coach Developer - PRD

## Original Problem Statement
A coaching observation platform (MyCoachDeveloper) for sports coaching development with multi-tenancy, session management, template management, subscription tiers, and admin capabilities.

## Core Features (Implemented)
- Multi-tenant coaching observation platform
- Session recording with events, ball rolling tracking, and timeline
- Observation templates (Training/Match Day) with configurable parts
- Reflection templates for observers and coaches
- Admin dashboard with organization management and impersonation
- Role-based access (Admin, Coach Developer, Coach)
- Free trial with subscription tiers (Stripe integration)
- Landing page, signup, login flows
- CSV/PDF export of sessions
- Coach profiles with analytics
- Admin template system (global/bootstrap defaults)
- Data isolation (organization_id filtering)
- Trial Extension & Activation for Admins
- Stripe subscription price auto-sync on tier changes
- Subscription Diagnose & Repair tool (searches Stripe by customer_id, email, org member emails)
- Admin manual subscription activation
- Deployment version badge on admin dashboard

## Architecture
- **Frontend**: React (CRA) with Shadcn/UI, Recharts
- **Backend**: FastAPI with MongoDB (Motor async driver)
- **Auth**: Session-based with cookies
- **Integrations**: Stripe, Resend (email), Google Analytics, OpenAI Whisper

## Key Technical Decisions
- Checkout session metadata now includes `organization_id`, `user_id`, `user_email` for proper subscription linking
- Webhook has fallback customer email lookup when metadata is missing
- Subscription priority: active non-trial subscriptions take precedence over expired trials
- Admin can manually activate any org's subscription via POST /api/admin/organizations/{org_id}/activate
- Deployment version: `DEPLOY_VERSION` constant in AdminDashboard.jsx (currently `v2.5.0`)

## What's Been Implemented (Chronological)
- Full coaching observation platform with session recording
- Admin template system overhaul
- Critical data leak fix (organization_id filtering)
- Riverside Football Academy demo data seeding
- Fixed reflection crash, impersonation data leak
- **[July 2026]** Admin Trial Extension feature
- **[July 2026]** Stripe subscription price auto-update on tier changes
- **[Aug 2026]** CRITICAL FIX: Trial-to-paid subscription entitlement bug (subscription priority logic)
- **[Aug 2026]** CRITICAL FIX: Checkout session metadata missing org_id/user_id — subscriptions created without org link
- **[Aug 2026]** Webhook fallback: resolves org_id from customer email when metadata is missing
- **[Aug 2026]** Admin "Activate Subscription" endpoint and UI button
- **[Aug 2026]** Enhanced Diagnose & Repair tool (Stripe email search, org member search, manual subscription ID)
- **[Aug 2026]** Deployment version badge (v2.5.0)

## Pending Issues
1. **P1 - Crewe Alexandra (production)**: User needs admin to run Diagnose & Repair or Activate Subscription after redeployment
2. **P2 - Production Sync Failure**: Long-standing infrastructure issue
3. **P2 - Unoptimized DB Queries**: Performance optimization needed

## Upcoming Tasks
1. **P1 - Free Trial Emails**: Implement Trial Started, Expiring Soon, Expired notifications via Resend
2. **P2 - Refactor ReviewSession.jsx**: Break 3000+ line component into smaller components
3. **P2 - Full E2E Verification**: Complete platform testing
4. **P3 - Refactor server.py**: Split admin routes into dedicated route files (6800+ lines)

## Key API Endpoints
- `POST /api/admin/organizations/{org_id}/activate` — Admin manually activates subscription
- `POST /api/admin/subscription/diagnose-repair` — Diagnose and repair subscription issues
- `POST /api/admin/organizations/{org_id}/extend-trial` — Extend/grant trial
- `POST /api/payments/checkout` — Create Stripe checkout (now includes user/org metadata)
- `GET /api/billing/entitlement` — Check subscription entitlement (priority-based)

## Test Credentials
- **Admin**: hello@mycoachdeveloper.com / _mcDeveloper26!
- **Demo Coach Dev**: sarah.mitchell@demo.mycoachdeveloper.com / Demo123!
- **Demo Coach**: michael.thompson@demo.mycoachdeveloper.com / Demo123!
