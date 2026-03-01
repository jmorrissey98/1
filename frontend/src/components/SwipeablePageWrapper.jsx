import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

// Main navigation pages in order
const MAIN_PAGES = [
  { path: '/', name: 'Home', icon: 'Home' },
  { path: '/coaches', name: 'Coaches', icon: 'Users' },
  { path: '/templates', name: 'Templates', icon: 'FileText' },
  { path: '/calendar', name: 'Calendar', icon: 'Calendar' },
  { path: '/settings', name: 'Settings', icon: 'Settings' }
];

/**
 * Wrapper component that adds swipe navigation between main app pages
 * Shows visual indicators during swipe and navigates on completion
 */
export function SwipeablePageWrapper({ children, className }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showIndicator, setShowIndicator] = useState({ direction: null, name: null });
  
  // Find current page index
  const currentIndex = MAIN_PAGES.findIndex(p => p.path === location.pathname);
  const isMainPage = currentIndex !== -1;
  
  const prevPage = currentIndex > 0 ? MAIN_PAGES[currentIndex - 1] : null;
  const nextPage = currentIndex < MAIN_PAGES.length - 1 ? MAIN_PAGES[currentIndex + 1] : null;
  
  const handleSwipeLeft = useCallback(() => {
    if (nextPage) {
      navigate(nextPage.path);
    }
  }, [nextPage, navigate]);
  
  const handleSwipeRight = useCallback(() => {
    if (prevPage) {
      navigate(prevPage.path);
    }
  }, [prevPage, navigate]);
  
  const { ref, isSwiping, swipeDirection, swipeProgress } = useSwipeNavigation({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    enabled: isMainPage,
    threshold: 80
  });
  
  // Update indicator based on swipe state
  useEffect(() => {
    if (isSwiping && swipeProgress > 0.3) {
      if (swipeDirection === 'left' && nextPage) {
        setShowIndicator({ direction: 'left', name: nextPage.name });
      } else if (swipeDirection === 'right' && prevPage) {
        setShowIndicator({ direction: 'right', name: prevPage.name });
      }
    } else {
      setShowIndicator({ direction: null, name: null });
    }
  }, [isSwiping, swipeDirection, swipeProgress, nextPage, prevPage]);

  // Only show swipe indicators on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div ref={ref} className={cn("min-h-screen relative", className)}>
      {/* Left swipe indicator (shows next page name) */}
      {isMobile && showIndicator.direction === 'left' && (
        <div 
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-slate-900/90 text-white px-3 py-2 rounded-l-lg flex items-center gap-2 z-50 animate-in slide-in-from-right duration-200"
          style={{ opacity: swipeProgress }}
        >
          <span className="text-sm font-medium">{showIndicator.name}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      )}
      
      {/* Right swipe indicator (shows prev page name) */}
      {isMobile && showIndicator.direction === 'right' && (
        <div 
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-slate-900/90 text-white px-3 py-2 rounded-r-lg flex items-center gap-2 z-50 animate-in slide-in-from-left duration-200"
          style={{ opacity: swipeProgress }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{showIndicator.name}</span>
        </div>
      )}
      
      {/* Page content */}
      {children}
      
      {/* Navigation dots indicator - only show on mobile main pages */}
      {isMobile && isMainPage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-900/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-40">
          {MAIN_PAGES.map((page, index) => (
            <button
              key={page.path}
              onClick={() => navigate(page.path)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex 
                  ? "bg-white w-4" 
                  : "bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to ${page.name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SwipeablePageWrapper;
