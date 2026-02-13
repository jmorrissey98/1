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
- **Manage Reflection Templates (NEW - Phase 3)**
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

### Previous Work
- Stripe checkout integration
- Landing page with pricing
- Signup loophole closed
- White screen crash fixed
- Cloud sync for observation sessions
- Admin dashboard with impersonation
- Token-based authentication

## Remaining Work / Backlog

### P0 - Critical (Next)
- [ ] **Live Observation Enhancements** - Phase 4
  - Notes toggle in Observation Templates editor
  - Notes button/panel during live observation
  - Coach name + Targets button in observation window
  - Reflection template selector per session
  - Auto-trigger reflection on session completion

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
- **Admin:** hello@mycoachdeveloper.com / _mcDeveloper26!
- **Coach Developer:** joemorrisseyg@gmail.com / 12345
- **Coach:** joe_morrissey@hotmail.co.uk / CoachTest123

## 3rd Party Integrations
- **Resend (Email API)** - Requires User API Key
- **recharts** - Charting library for React
- **Stripe** - Payment processing (Test Mode: sk_test_emergent)

## Key Files Reference

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
