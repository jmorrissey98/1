import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for detecting swipe gestures on mobile devices
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback when swiping left (next)
 * @param {Function} options.onSwipeRight - Callback when swiping right (previous)
 * @param {number} options.threshold - Minimum distance to trigger swipe (default: 50px)
 * @param {boolean} options.enabled - Whether swipe detection is enabled (default: true)
 * @returns {Object} - Ref to attach to the swipeable element and swipe state
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true
} = {}) {
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    setIsSwiping(true);
    setSwipeProgress(0);
  }, [enabled]);

  const handleTouchMove = useCallback((e) => {
    if (!enabled || !isSwiping) return;
    
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    
    const diffX = touchEndX.current - touchStartX.current;
    const diffY = touchEndY.current - touchStartY.current;
    
    // Only track horizontal swipes (ignore vertical scrolling)
    if (Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      // Calculate progress as percentage of threshold
      const progress = Math.min(Math.abs(diffX) / threshold, 1);
      setSwipeProgress(progress);
      setSwipeDirection(diffX > 0 ? 'right' : 'left');
      
      // Prevent vertical scroll when swiping horizontally
      if (Math.abs(diffX) > 10) {
        e.preventDefault();
      }
    }
  }, [enabled, isSwiping, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;
    
    const diffX = touchEndX.current - touchStartX.current;
    const diffY = touchEndY.current - touchStartY.current;
    
    // Only trigger if horizontal movement is greater than vertical
    if (Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX < -threshold && onSwipeLeft) {
        onSwipeLeft();
      } else if (diffX > threshold && onSwipeRight) {
        onSwipeRight();
      }
    }
    
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeProgress(0);
  }, [enabled, threshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref: containerRef,
    isSwiping,
    swipeDirection,
    swipeProgress
  };
}

/**
 * Hook for tab-based swipe navigation
 * @param {Array} tabs - Array of tab identifiers
 * @param {string} currentTab - Current active tab
 * @param {Function} setCurrentTab - Function to set the current tab
 * @param {boolean} enabled - Whether swipe is enabled
 */
export function useSwipeTabs({ tabs, currentTab, setCurrentTab, enabled = true }) {
  const currentIndex = tabs.indexOf(currentTab);
  
  const goToNextTab = useCallback(() => {
    if (currentIndex < tabs.length - 1) {
      setCurrentTab(tabs[currentIndex + 1]);
    }
  }, [currentIndex, tabs, setCurrentTab]);
  
  const goToPrevTab = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentTab(tabs[currentIndex - 1]);
    }
  }, [currentIndex, tabs, setCurrentTab]);
  
  return useSwipeNavigation({
    onSwipeLeft: goToNextTab,
    onSwipeRight: goToPrevTab,
    enabled,
    threshold: 60
  });
}

export default useSwipeNavigation;
