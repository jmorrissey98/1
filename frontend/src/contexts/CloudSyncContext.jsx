import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  fetchCloudSessions, 
  fetchCloudSession,
  saveCloudSession, 
  deleteCloudSession,
  cloudToLocalSession,
  SyncStatus,
  initCloudSync
} from '../lib/cloudSessionService';
import { storage as localStorage } from '../lib/storage';

const CloudSyncContext = createContext(null);

export function CloudSyncProvider({ children }) {
  const [syncStatus, setSyncStatus] = useState(SyncStatus.IDLE);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize sync listeners
  useEffect(() => {
    initCloudSync();
    
    const handleStatusChange = (e) => {
      setSyncStatus(e.detail.status);
      if (e.detail.lastSync) {
        setLastSyncTime(e.detail.lastSync);
      }
    };
    
    window.addEventListener('cloudSyncStatusChange', handleStatusChange);
    return () => window.removeEventListener('cloudSyncStatusChange', handleStatusChange);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    
    const result = await fetchCloudSessions();
    
    if (result.success) {
      setSessions(result.data);
    } else if (result.error === 'offline') {
      // Fall back to localStorage when offline
      const localSessions = localStorage.getSessions();
      setSessions(localSessions.map(s => ({
        session_id: s.id,
        name: s.name,
        coach_id: s.coachId,
        status: s.status,
        observation_context: s.observationContext,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        total_duration: s.totalDuration,
        event_count: s.events?.length || 0
      })));
    }
    
    setLoading(false);
  }, []);

  const getSession = useCallback(async (sessionId) => {
    // First try cloud
    const result = await fetchCloudSession(sessionId);
    
    if (result.success && result.data) {
      return cloudToLocalSession(result.data);
    }
    
    // Fall back to localStorage
    const localSession = localStorage.getSession(sessionId);
    return localSession;
  }, []);

  const saveSession = useCallback(async (session) => {
    // Always save to localStorage first for offline support
    localStorage.saveSession(session);
    
    // Then sync to cloud
    const result = await saveCloudSession(session);
    
    if (result.success) {
      // Refresh session list
      loadSessions();
    }
    
    return result;
  }, [loadSessions]);

  const deleteSession = useCallback(async (sessionId) => {
    // Delete from localStorage
    localStorage.deleteSession(sessionId);
    
    // Delete from cloud
    const result = await deleteCloudSession(sessionId);
    
    // Refresh session list
    loadSessions();
    
    return result;
  }, [loadSessions]);

  const value = {
    // State
    syncStatus,
    lastSyncTime,
    sessions,
    loading,
    
    // Actions
    loadSessions,
    getSession,
    saveSession,
    deleteSession,
    
    // Status helpers
    isOnline: navigator.onLine,
    isSyncing: syncStatus === SyncStatus.SYNCING,
    isSynced: syncStatus === SyncStatus.SYNCED,
    isOffline: syncStatus === SyncStatus.OFFLINE,
    hasError: syncStatus === SyncStatus.ERROR
  };

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider');
  }
  return context;
}
