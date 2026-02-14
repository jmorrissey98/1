/**
 * Google Analytics 4 (GA4) Analytics Module
 * 
 * Centralized analytics utility for tracking page views, feature usage, and view duration.
 * Only runs in production builds.
 */

const GA_MEASUREMENT_ID = 'G-713PP3YYYZ';

// Check if we're in production (not localhost or development)
const isProduction = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && 
         hostname !== '127.0.0.1' && 
         !hostname.includes('localhost');
};

// Flag to track if GA has been initialized
let isInitialized = false;

/**
 * Initialize Google Analytics (called once at app startup)
 */
export function initializeGA() {
  if (isInitialized) {
    console.debug('[Analytics] Already initialized, skipping');
    return;
  }

  if (!isProduction()) {
    console.debug('[Analytics] Skipping GA initialization in development');
    return;
  }

  // Check if gtag is available (loaded via index.html)
  if (typeof window.gtag !== 'function') {
    console.warn('[Analytics] gtag not found. Ensure GA script is in index.html');
    return;
  }

  isInitialized = true;
  console.debug('[Analytics] GA4 initialized with ID:', GA_MEASUREMENT_ID);
}

/**
 * Route path to view name mapping
 * Normalizes dynamic routes by removing IDs/params
 */
const ROUTE_VIEW_MAP = {
  '/': 'landing',
  '/login': 'login',
  '/reset-password': 'reset_password',
  '/auth/callback': 'auth_callback',
  '/dashboard': 'dashboard',
  '/coach': 'coach_dashboard',
  '/coach/development': 'coach_development',
  '/coach/sessions': 'coach_sessions',
  '/coach/session': 'coach_session_detail',
  '/coach/profile': 'coach_profile',
  '/session/new': 'session_new',
  '/session/setup': 'session_setup',
  '/session/observe': 'live_observation',
  '/session/review': 'session_review',
  '/templates': 'templates',
  '/coaches': 'my_coaches',
  '/coach-view': 'coach_view',
  '/calendar': 'calendar',
  '/settings': 'settings',
  '/data-recovery': 'data_recovery',
  '/admin': 'admin_dashboard',
  '/admin/clubs/new': 'admin_create_club',
  '/admin/clubs': 'admin_club_details',
  '/admin/users/new': 'admin_create_user',
  '/register': 'invite_registration',
};

/**
 * Normalize a pathname to a view name
 * Strips dynamic segments (IDs, UUIDs) and maps to friendly names
 */
export function normalizePathToViewName(pathname) {
  // Direct match first
  if (ROUTE_VIEW_MAP[pathname]) {
    return ROUTE_VIEW_MAP[pathname];
  }

  // Handle dynamic routes by stripping IDs
  // Pattern: /something/:id/action -> /something/action
  const segments = pathname.split('/').filter(Boolean);
  
  // Check for known patterns with dynamic IDs
  if (segments[0] === 'session' && segments.length >= 3) {
    // /session/:sessionId/observe -> live_observation
    // /session/:sessionId/review -> session_review
    // /session/:sessionId/setup -> session_setup
    const action = segments[2];
    if (action === 'observe') return 'live_observation';
    if (action === 'review') return 'session_review';
    if (action === 'setup') return 'session_setup';
  }

  if (segments[0] === 'coaches' && segments.length === 2) {
    // /coaches/:coachId -> coach_profile
    return 'coach_profile';
  }

  if (segments[0] === 'coach' && segments[1] === 'session' && segments.length === 3) {
    // /coach/session/:sessionId -> coach_session_detail
    return 'coach_session_detail';
  }

  if (segments[0] === 'coach-view' && segments.length === 2) {
    // /coach-view/:coachId -> coach_view
    return 'coach_view';
  }

  if (segments[0] === 'admin' && segments[1] === 'clubs' && segments.length === 3) {
    // /admin/clubs/:orgId -> admin_club_details
    return 'admin_club_details';
  }

  if (segments[0] === 'register' && segments.length === 2) {
    // /register/:inviteId -> invite_registration
    return 'invite_registration';
  }

  // Fallback: convert path to snake_case view name
  const normalized = pathname
    .replace(/^\//, '')           // Remove leading slash
    .replace(/\/[a-zA-Z0-9_-]{8,}(?:\/|$)/g, '/') // Remove UUID-like segments
    .replace(/\//g, '_')          // Replace slashes with underscores
    .replace(/-/g, '_')           // Replace hyphens with underscores
    .replace(/_+/g, '_')          // Collapse multiple underscores
    .replace(/_$/, '')            // Remove trailing underscore
    .toLowerCase();

  return normalized || 'unknown';
}

/**
 * Get a human-readable page title from view name
 */
export function getPageTitle(viewName) {
  const titles = {
    landing: 'My Coach Developer',
    login: 'Login',
    reset_password: 'Reset Password',
    auth_callback: 'Authenticating',
    dashboard: 'Dashboard',
    coach_dashboard: 'Coach Dashboard',
    coach_development: 'My Development',
    coach_sessions: 'My Sessions',
    coach_session_detail: 'Session Detail',
    coach_profile: 'My Profile',
    session_new: 'New Session',
    session_setup: 'Session Setup',
    live_observation: 'Live Observation',
    session_review: 'Session Review',
    templates: 'Templates',
    my_coaches: 'My Coaches',
    coach_view: 'Coach View',
    calendar: 'Calendar',
    settings: 'Settings',
    data_recovery: 'Data Recovery',
    admin_dashboard: 'Admin Dashboard',
    admin_create_club: 'Create Club',
    admin_club_details: 'Club Details',
    admin_create_user: 'Create User',
    invite_registration: 'Register',
  };

  return titles[viewName] || viewName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Track a page view in GA4
 * @param {string} pathname - The current route pathname
 */
let lastTrackedPath = null;
let pageViewDebounceTimer = null;

export function trackPageView(pathname) {
  if (!isProduction() || typeof window.gtag !== 'function') {
    console.debug('[Analytics] trackPageView (dev):', pathname);
    return;
  }

  // Debounce rapid route changes (e.g., redirects)
  if (pageViewDebounceTimer) {
    clearTimeout(pageViewDebounceTimer);
  }

  pageViewDebounceTimer = setTimeout(() => {
    // Prevent duplicate tracking of the same path
    if (pathname === lastTrackedPath) {
      console.debug('[Analytics] Skipping duplicate page_view:', pathname);
      return;
    }

    lastTrackedPath = pathname;
    const viewName = normalizePathToViewName(pathname);
    const pageTitle = getPageTitle(viewName);

    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_title: pageTitle,
      page_location: window.location.href,
    });

    console.debug('[Analytics] page_view:', { pathname, viewName, pageTitle });
  }, 100); // 100ms debounce
}

/**
 * Track feature/view usage
 * Fires every time a route is entered
 * @param {string} pathname - The current route pathname
 */
export function trackFeatureView(pathname) {
  if (!isProduction() || typeof window.gtag !== 'function') {
    console.debug('[Analytics] trackFeatureView (dev):', pathname);
    return;
  }

  const viewName = normalizePathToViewName(pathname);
  const eventName = `view_${viewName}`;

  window.gtag('event', eventName, {
    view_name: viewName,
    page_path: pathname,
  });

  console.debug('[Analytics] Feature view:', eventName);
}

/**
 * Track view duration when leaving a view
 * @param {string} viewName - The view being exited
 * @param {number} durationMs - Time spent on the view in milliseconds
 */
export function trackViewDuration(viewName, durationMs) {
  // Only track meaningful durations (at least 500ms, less than 30 minutes)
  if (durationMs < 500 || durationMs > 30 * 60 * 1000) {
    console.debug('[Analytics] Skipping invalid duration:', durationMs);
    return;
  }

  if (!isProduction() || typeof window.gtag !== 'function') {
    console.debug('[Analytics] view_duration (dev):', { viewName, durationMs });
    return;
  }

  window.gtag('event', 'view_duration', {
    view_name: viewName,
    duration_ms: Math.round(durationMs),
    duration_seconds: Math.round(durationMs / 1000),
  });

  console.debug('[Analytics] view_duration:', { viewName, durationMs });
}

/**
 * Track custom events
 * @param {string} eventName - Event name (will be snake_cased)
 * @param {object} params - Event parameters
 */
export function trackEvent(eventName, params = {}) {
  if (!isProduction() || typeof window.gtag !== 'function') {
    console.debug('[Analytics] trackEvent (dev):', eventName, params);
    return;
  }

  window.gtag('event', eventName, params);
  console.debug('[Analytics] Custom event:', eventName, params);
}

/**
 * Track user identification (when user logs in)
 * @param {string} userId - The user's unique ID
 */
export function identifyUser(userId) {
  if (!isProduction() || typeof window.gtag !== 'function') {
    console.debug('[Analytics] identifyUser (dev):', userId);
    return;
  }

  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: userId,
  });

  console.debug('[Analytics] User identified:', userId);
}

/**
 * Clear user identification (when user logs out)
 */
export function clearUserIdentity() {
  if (!isProduction() || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: undefined,
  });

  console.debug('[Analytics] User identity cleared');
}

// Export the measurement ID for reference
export const MEASUREMENT_ID = GA_MEASUREMENT_ID;
