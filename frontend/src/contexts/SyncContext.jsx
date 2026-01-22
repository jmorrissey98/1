// Offline Sync Context - provides sync status and controls throughout the app
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getSyncStatus,
  getPendingSyncCount,
  getLastSyncTime,
  syncOfflineData,
  initSyncListeners,
  registerBackgroundSync,
  isOnline,
  SyncStatus,
  getOfflineQueue
} from '../lib/offlineSync';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [pendingCount, setPendingCount] = useState(getPendingSyncCount());
  const [lastSync, setLastSync] = useState(getLastSyncTime());
  const [online, setOnline] = useState(isOnline());
  const [swRegistration, setSwRegistration] = useState(null);

  // Initialize sync system
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('[PWA] Service worker registered:', registration.scope);
          setSwRegistration(registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available
                console.log('[PWA] New content available, refresh to update');
                window.dispatchEvent(new CustomEvent('swUpdate', { detail: registration }));
              }
            });
          });
        })
        .catch((error) => {
          console.error('[PWA] Service worker registration failed:', error);
        });
    }

    // Initialize listeners
    initSyncListeners();
    registerBackgroundSync();

    // Listen for status changes
    const handleStatusChange = (e) => {
      setSyncStatus(e.detail.status);
      setPendingCount(getPendingSyncCount());
      setLastSync(getLastSyncTime());
    };

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('syncStatusChange', handleStatusChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setPendingCount(getPendingSyncCount());
    setOnline(isOnline());

    return () => {
      window.removeEventListener('syncStatusChange', handleStatusChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Manual sync trigger
  const triggerManualSync = useCallback(async () => {
    if (!online) {
      return { success: false, reason: 'offline' };
    }
    
    const result = await syncOfflineData();
    setPendingCount(getPendingSyncCount());
    setLastSync(getLastSyncTime());
    return result;
  }, [online]);

  // Skip waiting for new service worker
  const updateServiceWorker = useCallback(() => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [swRegistration]);

  // Get queue items (for debugging)
  const getQueueItems = useCallback(() => {
    return getOfflineQueue();
  }, []);

  const value = {
    syncStatus,
    pendingCount,
    lastSync,
    online,
    triggerManualSync,
    updateServiceWorker,
    getQueueItems,
    SyncStatus
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export { SyncStatus };
