import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader2, Check, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { isOnline } from '../lib/offlineSync';

/**
 * Pull-to-refresh component for mobile devices
 * Wraps content and provides pull-down refresh functionality
 */
export function PullToRefresh({ 
  children, 
  onRefresh, 
  className,
  disabled = false,
  refreshingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh',
  successText = 'Updated!',
  offlineText = 'Offline - showing cached data'
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshState, setRefreshState] = useState('idle'); // idle, pulling, ready, refreshing, success
  const [online, setOnline] = useState(isOnline());
  
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const isAtTop = useRef(true);
  
  const PULL_THRESHOLD = 80; // Distance needed to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance
  const RESISTANCE = 2.5; // Pull resistance factor

  // Track online status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;
    
    // Check if we're at the top of the scroll container
    const container = containerRef.current;
    isAtTop.current = container ? container.scrollTop <= 0 : true;
    
    if (isAtTop.current) {
      touchStartY.current = e.touches[0].clientY;
      touchCurrentY.current = e.touches[0].clientY;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || isRefreshing || !isAtTop.current) return;
    
    touchCurrentY.current = e.touches[0].clientY;
    const diff = touchCurrentY.current - touchStartY.current;
    
    // Only handle downward pull
    if (diff > 0) {
      // Apply resistance to make it feel natural
      const adjustedDiff = Math.min(diff / RESISTANCE, MAX_PULL);
      setPullDistance(adjustedDiff);
      
      if (adjustedDiff >= PULL_THRESHOLD) {
        setRefreshState('ready');
      } else if (adjustedDiff > 0) {
        setRefreshState('pulling');
      }
      
      // Prevent default scroll behavior when pulling
      if (adjustedDiff > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    
    if (pullDistance >= PULL_THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      setRefreshState('refreshing');
      setPullDistance(60); // Keep indicator visible
      
      try {
        await onRefresh();
        setRefreshState('success');
        // Show success state briefly
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setRefreshState('idle');
        setPullDistance(0);
      }
    } else {
      // Animate back to original position
      setPullDistance(0);
      setRefreshState('idle');
    }
  }, [disabled, isRefreshing, pullDistance, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const getIndicatorContent = () => {
    if (!online) {
      return (
        <>
          <WifiOff className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-amber-600">{offlineText}</span>
        </>
      );
    }
    
    switch (refreshState) {
      case 'pulling':
        return (
          <>
            <RefreshCw 
              className="w-4 h-4 text-slate-400 transition-transform" 
              style={{ transform: `rotate(${pullDistance * 2}deg)` }}
            />
            <span className="text-xs text-slate-500">{pullText}</span>
          </>
        );
      case 'ready':
        return (
          <>
            <RefreshCw className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-xs text-blue-600 font-medium">{releaseText}</span>
          </>
        );
      case 'refreshing':
        return (
          <>
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-xs text-blue-600">{refreshingText}</span>
          </>
        );
      case 'success':
        return (
          <>
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600">{successText}</span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      style={{ touchAction: pullDistance > 0 ? 'none' : 'auto' }}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center gap-2 transition-all duration-200 z-10",
          pullDistance > 0 || refreshState === 'refreshing' || refreshState === 'success' 
            ? "opacity-100" 
            : "opacity-0"
        )}
        style={{ 
          top: 0,
          height: `${Math.max(pullDistance, refreshState === 'refreshing' || refreshState === 'success' ? 60 : 0)}px`,
          minHeight: pullDistance > 0 || refreshState === 'refreshing' || refreshState === 'success' ? '40px' : '0'
        }}
      >
        {getIndicatorContent()}
      </div>
      
      {/* Content with transform */}
      <div 
        className="transition-transform duration-200"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transitionDuration: pullDistance === 0 ? '200ms' : '0ms'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
