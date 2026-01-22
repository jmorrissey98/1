# My Coach Developer - Product Requirements Document

## Original Problem Statement
Build a lightweight iPad-first coach observation app for coach education. Designed for live observation of coaching sessions, focusing on coaching interventions, how they are delivered, and how session time is used. Must prioritise speed, clarity, and low cognitive load during live observation.

## User Personas
1. **Coach Educators** - Professionals who observe and mentor coaches
2. **Sports Coaches** - Conducting self-reflection on their coaching sessions
3. **Development Officers** - Tracking coach development across programs

## Core Requirements (Static)
- Grid-based code window for live observation
- Yellow event buttons (Command, Q&A, Guided Discovery)
- Two descriptor groups (Content Focus, Delivery Method)
- Session timer (always visible)
- Ball rolling vs ball not rolling toggle
- Session parts management (Warm Up, Practice, Game, Reflection)
- Local storage (offline-first)
- Post-session review with whole/part views
- PDF report with visualizations
- CSV export for raw data
- Session templates

## What's Been Implemented (January 2025)

### MVP Features
- ✅ Home page with sessions list
- ✅ Session setup with customizable interventions, descriptors, parts
- ✅ Template management system (full editing capability)
- ✅ Live observation screen with 3-column grid
- ✅ Real-time timer display
- ✅ Ball rolling toggle with time tracking (persists across part changes)
- ✅ Session parts switching + add parts during session
- ✅ Unused parts automatically removed on session end
- ✅ Default parts renamed to Part 1, Part 2, Part 3, Part 4
- ✅ Coach Intervention logging (renamed from Events)
- ✅ Descriptor selection (inline, no modals)
- ✅ Quick undo functionality
- ✅ Post-session review with Summary, Reflections & AI, Timeline, Charts tabs
- ✅ Whole session / per-part data toggle
- ✅ Intervention editing/deletion in review
- ✅ Observer reflections (timestamped, per session)
- ✅ Coach reflections (timestamped, per session)
- ✅ AI-generated session summary with suggested development targets
- ✅ AI summary collapsible by default
- ✅ Session attachments (file upload/download)
- ✅ PDF export with styled report
- ✅ CSV export with raw data
- ✅ Local storage persistence

### Observation Contexts
- ✅ Training Observation context
- ✅ Game Observation context
- ✅ Context-aware labeling in summaries

### Session Planning
- ✅ Plan sessions in advance with date
- ✅ Calendar view for all sessions
- ✅ Planned sessions show as "Planned" status
- ✅ Navigate directly from calendar to observation

### Coach Management System
- ✅ My Coaches section with list of coach profiles
- ✅ Coach profile page with Overview, Targets, Sessions tabs
- ✅ Add/edit coach name, role, general notes
- ✅ Development targets per coach (add, toggle achieved, delete)
- ✅ Intervention style targets (optional, age-group specific)
- ✅ Session history per coach
- ✅ AI-generated trends summary across all sessions
- ✅ Link sessions to coaches during setup
- ✅ One-off sessions supported (no coach linked)
- ✅ AI summary references coach targets and previous sessions
- ✅ Coach profile attachments support

### User Roles & Access Control
- ✅ Coach Developer role (full access)
- ✅ Coach role (restricted view)
- ✅ User Settings page (/settings) with role selection
- ✅ Coach role shows "Link to Coach Profile" option
- ✅ Coach View page (/coach-view/:coachId) for restricted access
- ✅ Auto-redirect Coach users to their Coach View

### Coach Reporting
- ✅ Time-period based report export on Coach Profile
- ✅ Reports tab with date range pickers (start/end)
- ✅ Quick date presets (Last 7 Days, 30 Days, 3 Months, Year to Date)
- ✅ Export to PDF with aggregate statistics
- ✅ Export to CSV with detailed data
- ✅ Report preview showing session count in range

### Session Planning Enhancements
- ✅ Auto-fill date when planning from calendar
- ✅ URL parameter ?date=YYYY-MM-DD support

### UX Polish
- ✅ Large touch-friendly buttons (64px+)
- ✅ Clear state visibility (timer, part, ball rolling)
- ✅ Subtle event feedback (pulse animation + toast)
- ✅ Fast descriptor selection without modals
- ✅ Professional, calm design
- ✅ **Responsive design for iPad and laptop**
  - Safe area insets for iPad
  - Touch-optimized button sizes
  - Responsive grids (2-col on iPad, 3-col on laptop)
  - Flexible header layouts
  - Proper text scaling across devices

### PWA & Offline-First (Jan 2026)
- ✅ **Progressive Web App (PWA)** - Installable on iPad, phone, and desktop
  - manifest.json with app icons and metadata
  - Service worker for offline caching
  - Apple touch icon for iOS home screen
- ✅ **Offline Indicator** - Non-intrusive sync status in corner
  - Shows online/offline status
  - Displays pending sync count
  - Manual sync trigger when online
- ✅ **Offline Data Queue** - Changes saved locally when offline
  - Session parts creation queued when offline
  - "Most recent edit wins" conflict resolution
  - Automatic sync when coming back online
- ✅ **Service Worker** - Caches app shell for offline use
  - Static assets cached on install
  - Network-first for HTML, cache-first for assets
  - Graceful fallbacks when offline

## Prioritized Backlog

### P0 (Critical) - COMPLETE
All core observation and review features implemented
PWA and offline-first functionality implemented

### P1 (High Priority) - Future
- Cloud backup/sync option
- Multiple observer support
- Session comparison view
- Print-friendly review layout

### P2 (Medium Priority) - Future
- Voice notes for events
- Photo attachments
- Custom color themes
- Session sharing via link

### P3 (Low Priority) - Future
- Coach profile management
- Historical trends analysis
- Integration with calendar
- Multi-language support

## Out of Scope (Explicit)
- Video recording/playback
- Player data tracking
- Performance metrics/scoring
- AI-powered analysis
- Judgement/grading of coaching quality

## Session Parts System (Updated Jan 2026)

### Global Default Session Parts (stored in MongoDB)
- ✅ Develop the technique
- ✅ Develop the game model
- ✅ Develop performance
- ✅ Develop mentality

### Session Parts Features
- ✅ Coach Developers can select from defaults or create custom parts
- ✅ Custom parts can be added as "new default" (globally available) or "one-off" (session-only)
- ✅ Same part can be used multiple times in a session (multiple time ranges)
- ✅ Track total session duration and duration per part
- ✅ **Templates page has "Add as global default" option** (Jan 2026 fix)
- ✅ Coaches can only select from existing parts (cannot create defaults)

### Session Parts Analysis
- ✅ Session-level: View all data or filter by any session part
- ✅ Coach Profile: Filter data by session parts (defaults + custom)
- ✅ Data is descriptive only (counts, frequencies, percentages - no scoring)

### API Endpoints
- GET /api/session-parts - Get all session parts
- GET /api/session-parts/defaults - Get only default parts
- POST /api/session-parts - Create new part (is_default flag for Coach Developers)
- DELETE /api/session-parts/{part_id} - Delete custom part (Coach Developer only)

## Coach Profile Enhancements (Jan 2026)

### Profile Photo Upload
- ✅ Upload profile photo for coaches
- ✅ Photo displayed in header and profile tab
- ✅ Max 5MB, image files only
- ✅ Remove photo option

### File Attachments
- ✅ Attach documents to coach profiles (development plans, certificates, etc.)
- ✅ Max 10MB per file
- ✅ View/download attachments
- ✅ Remove attachments

### Optional Non-Evaluative Targets
- ✅ Targets are now called "Focus Areas"
- ✅ Clear messaging that targets are optional and non-evaluative
- ✅ No scoring or assessment linked to targets
- ✅ Reference-only for development tracking

## Next Tasks
1. Test Google OAuth flow end-to-end
2. Coach profile photo upload
3. File attachments for coach profiles
4. Optional non-evaluative targets feature

## Authentication System
- ✅ Emergent Google OAuth integration
- ✅ Invite-only registration (Coach Developers invite coaches)
- ✅ First user becomes Coach Developer (admin)
- ✅ Role-based access control (coach_developer vs coach)
- ✅ Auto-link coach profiles to user accounts via email
- ✅ User Settings page with invite management
- ✅ Protected routes based on role
