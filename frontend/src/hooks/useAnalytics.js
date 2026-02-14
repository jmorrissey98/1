import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initializeGA,
  trackPageView,
  trackFeatureView,
  trackViewDuration,
  normalizePathToViewName,
} from '../lib/analytics';

/**
 * Hook to track analytics for route changes and view duration
 * Should be used once at the top level of the app (inside BrowserRouter)
 */
export function useAnalytics() {
  const location = useLocation();
  const entryTimeRef = useRef(null);
  const currentViewRef = useRef(null);
  const isInitialMount = useRef(true);

  // Initialize GA on first mount
  useEffect(() => {
    initializeGA();
  }, []);

  // Handle view duration tracking on unmount/route change
  const recordViewDuration = useCallback(() => {
    if (entryTimeRef.current && currentViewRef.current) {
      const durationMs = Date.now() - entryTimeRef.current;
      trackViewDuration(currentViewRef.current, durationMs);
    }
  }, []);

  // Track route changes
  useEffect(() => {
    const pathname = location.pathname;
    const newViewName = normalizePathToViewName(pathname);

    // Record duration for previous view before switching
    if (!isInitialMount.current) {
      recordViewDuration();
    }

    // Track new page view and feature view
    trackPageView(pathname);
    trackFeatureView(pathname);

    // Start timing for new view
    entryTimeRef.current = Date.now();
    currentViewRef.current = newViewName;
    isInitialMount.current = false;

    // Cleanup: record duration when component unmounts or route changes
    return () => {
      // Duration will be recorded on next route change or unmount
    };
  }, [location.pathname, recordViewDuration]);

  // Handle page unload/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      recordViewDuration();
    };

    // Handle visibility change (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordViewDuration();
      } else if (document.visibilityState === 'visible' && currentViewRef.current) {
        // Reset entry time when tab becomes visible again
        entryTimeRef.current = Date.now();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Record final duration on cleanup
      recordViewDuration();
    };
  }, [recordViewDuration]);

  return null;
}

/**
 * Component wrapper for useAnalytics hook
 * Use this if you prefer a component-based approach
 */
export function AnalyticsTracker() {
  useAnalytics();
  return null;
}

export default useAnalytics;
