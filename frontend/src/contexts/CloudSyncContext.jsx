import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Cache for active sessions to persist across navigation
  const sessionCache = useRef(new Map());
  // Track the currently active session
  const [activeSession, setActiveSession] = useState(null);

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
    
    if (result.success && Array.isArray(result.data)) {
      setSessions(result.data);
      // Update cache with session list data
      result.data.forEach(s => {
        if (!sessionCache.current.has(s.session_id)) {
          sessionCache.current.set(s.session_id, { 
            id: s.session_id,
            name: s.name,
            coachId: s.coach_id,
            status: s.status,
            observationContext: s.observation_context,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            totalDuration: s.total_duration || 0,
            events: []
          });
        }
      });
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

  const getSession = useCallback(async (sessionId, forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh && sessionCache.current.has(sessionId)) {
      const cached = sessionCache.current.get(sessionId);
      // Only return from cache if it has full data (events, etc.)
      if (cached.events && cached.interventionTypes) {
        console.log('[CloudSync] Returning session from cache:', sessionId);
        return cached;
      }
    }
    
    // Try cloud first
    console.log('[CloudSync] Fetching session from cloud:', sessionId);
    const result = await fetchCloudSession(sessionId);
    
    if (result.success && result.data) {
      const session = cloudToLocalSession(result.data);
      // Update cache
      sessionCache.current.set(sessionId, session);
      // Also save to localStorage for offline support
      localStorage.saveSession(session);
      return session;
    }
    
    // Fall back to localStorage
    console.log('[CloudSync] Falling back to localStorage:', sessionId);
    const localSession = localStorage.getSession(sessionId);
    if (localSession) {
      sessionCache.current.set(sessionId, localSession);
    }
    return localSession;
  }, []);

  const saveSession = useCallback(async (session) => {
    // Update cache immediately for instant UI updates
    sessionCache.current.set(session.id, session);
    
    // Update active session if this is the active one
    if (activeSession?.id === session.id) {
      setActiveSession(session);
    }
    
    // Save to localStorage first for offline support
    localStorage.saveSession(session);
    
    // Then sync to cloud
    const result = await saveCloudSession(session);
    
    if (result.success) {
      // Refresh session list in background
      loadSessions();
    }
    
    return result;
  }, [loadSessions, activeSession]);

  const deleteSession = useCallback(async (sessionId) => {
    // Remove from cache
    sessionCache.current.delete(sessionId);
    
    // Clear active session if this is the one being deleted
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
    }
    
    // Delete from localStorage
    localStorage.deleteSession(sessionId);
    
    // Delete from cloud
    const result = await deleteCloudSession(sessionId);
    
    // Refresh session list
    loadSessions();
    
    return result;
  }, [loadSessions, activeSession]);

  // Set the active session (for tracking during observation)
  const setCurrentSession = useCallback((session) => {
    if (session) {
      sessionCache.current.set(session.id, session);
      setActiveSession(session);
    } else {
      setActiveSession(null);
    }
  }, []);

  // Get session from cache synchronously (for immediate UI needs)
  const getCachedSession = useCallback((sessionId) => {
    return sessionCache.current.get(sessionId) || null;
  }, []);

  const value = {
    // State
    syncStatus,
    lastSyncTime,
    sessions,
    loading,
    activeSession,
    
    // Actions
    loadSessions,
    getSession,
    saveSession,
    deleteSession,
    setCurrentSession,
    getCachedSession,
    
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
