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
- ✅ Session setup with customizable events, descriptors, parts
- ✅ Template management system (full editing capability)
- ✅ Live observation screen with 3-column grid
- ✅ Real-time timer display
- ✅ Ball rolling toggle with time tracking (tracks from session start, defaults to "not rolling")
- ✅ Session parts switching + add parts during session
- ✅ Unused parts automatically removed on session end
- ✅ Default parts renamed to Part 1, Part 2, Part 3, Part 4
- ✅ Event logging with toast feedback
- ✅ Descriptor selection (inline, no modals)
- ✅ Quick undo functionality
- ✅ Post-session review with Summary, Notes & AI, Timeline, Charts tabs
- ✅ Whole session / per-part data toggle
- ✅ Event editing/deletion in review
- ✅ Session notes (observer can add reflections)
- ✅ AI-generated session summary with suggested development targets
- ✅ PDF export with styled report (includes AI summary + notes)
- ✅ CSV export with raw data
- ✅ Local storage persistence

### Coach Management System
- ✅ My Coaches section with list of coach profiles
- ✅ Coach profile page with Overview, Targets, Sessions tabs
- ✅ Add/edit coach name, role, general notes
- ✅ Development targets per coach (add, toggle achieved, delete)
- ✅ Session history per coach
- ✅ AI-generated trends summary across all sessions for a coach
- ✅ Link sessions to coaches during setup
- ✅ One-off sessions supported (no coach linked)
- ✅ AI summary references coach targets and previous sessions

### UX Polish
- ✅ Large touch-friendly buttons (64px+)
- ✅ Clear state visibility (timer, part, ball rolling)
- ✅ Subtle event feedback (pulse animation + toast)
- ✅ Fast descriptor selection without modals
- ✅ Professional, calm design

## Prioritized Backlog

### P0 (Critical) - COMPLETE
All core observation and review features implemented

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

## Next Tasks
1. User testing with real coach educators
2. iPad-specific optimizations (orientation, safe areas)
3. Cloud backup integration (optional)
4. Session comparison feature
