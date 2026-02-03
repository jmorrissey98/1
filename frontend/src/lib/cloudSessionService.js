// Cloud Session Service - Handles all session data sync with the cloud database
import { safeGet, safePost, safePut, safeDelete } from './safeFetch';

const API_URL = '';

// Sync status management
let syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error', 'offline'
let lastSyncTime = null;
const syncListeners = new Set();

export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ERROR: 'error',
  OFFLINE: 'offline'
};

export const getSyncStatus = () => syncStatus;
export const getLastSyncTime = () => lastSyncTime;

export const addSyncListener = (listener) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const notifySyncListeners = () => {
  syncListeners.forEach(listener => listener({ status: syncStatus, lastSync: lastSyncTime }));
  window.dispatchEvent(new CustomEvent('cloudSyncStatusChange', { 
    detail: { status: syncStatus, lastSync: lastSyncTime } 
  }));
};

const setSyncStatus = (status) => {
  syncStatus = status;
  if (status === SyncStatus.SYNCED) {
    lastSyncTime = new Date().toISOString();
  }
  notifySyncListeners();
};

// Check if online
export const isOnline = () => navigator.onLine;

// ============================================
// SESSION CRUD OPERATIONS
// ============================================

/**
 * Fetch all sessions from the cloud
 */
export const fetchCloudSessions = async () => {
  if (!navigator.onLine) {
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline', data: [] };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    const result = await safeGet(`${API_URL}/api/observations`);
    
    if (result.networkError) {
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network', data: [] };
    }
    
    if (!result.ok) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Failed to fetch', data: [] };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true, data: result.data || [] };
  } catch (error) {
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Fetch a single session from the cloud
 */
export const fetchCloudSession = async (sessionId) => {
  if (!navigator.onLine) {
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline', data: null };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    const result = await safeGet(`${API_URL}/api/observations/${sessionId}`);
    
    if (result.networkError) {
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network', data: null };
    }
    
    if (!result.ok) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Session not found', data: null };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true, data: result.data };
  } catch (error) {
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message, data: null };
  }
};

/**
 * Save a session to the cloud (create or update)
 */
export const saveCloudSession = async (session) => {
  if (!navigator.onLine) {
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline' };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    // Map frontend session format to API format
    const payload = {
      session_id: session.id,
      name: session.name,
      coach_id: session.coachId || null,
      observation_context: session.observationContext || 'training',
      status: session.status || 'draft',
      planned_date: session.plannedDate || null,
      intervention_types: session.interventionTypes || session.eventTypes || [],
      descriptor_group1: session.descriptorGroup1 || null,
      descriptor_group2: session.descriptorGroup2 || null,
      session_parts: session.sessionParts || [],
      start_time: session.startTime || null,
      end_time: session.endTime || null,
      total_duration: session.totalDuration || 0,
      ball_rolling_time: session.ballRollingTime || 0,
      ball_not_rolling_time: session.ballNotRollingTime || 0,
      ball_rolling: session.ballRolling || false,
      active_part_id: session.activePartId || null,
      events: session.events || [],
      ball_rolling_log: session.ballRollingLog || [],
      observer_reflections: session.observerReflections || [],
      coach_reflections: session.coachReflections || [],
      session_notes: session.sessionNotes || '',
      ai_summary: session.aiSummary || '',
      attachments: session.attachments || []
    };
    
    const result = await safePost(`${API_URL}/api/observations`, payload);
    
    if (result.networkError) {
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network' };
    }
    
    if (!result.ok) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Failed to save' };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true, synced_at: result.data?.synced_at };
  } catch (error) {
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a session from the cloud
 */
export const deleteCloudSession = async (sessionId) => {
  if (!navigator.onLine) {
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline' };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    const result = await safeDelete(`${API_URL}/api/observations/${sessionId}`);
    
    if (result.networkError) {
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network' };
    }
    
    if (!result.ok) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Failed to delete' };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true };
  } catch (error) {
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message };
  }
};

/**
 * Convert cloud session format to frontend format
 */
export const cloudToLocalSession = (cloudSession) => {
  return {
    id: cloudSession.session_id,
    name: cloudSession.name,
    coachId: cloudSession.coach_id,
    coachName: cloudSession.coach_name,
    observerId: cloudSession.observer_id,
    observerName: cloudSession.observer_name,
    observationContext: cloudSession.observation_context,
    status: cloudSession.status,
    plannedDate: cloudSession.planned_date,
    createdAt: cloudSession.created_at,
    updatedAt: cloudSession.updated_at,
    interventionTypes: cloudSession.intervention_types || [],
    eventTypes: cloudSession.intervention_types || [], // Backwards compat
    descriptorGroup1: cloudSession.descriptor_group1,
    descriptorGroup2: cloudSession.descriptor_group2,
    sessionParts: cloudSession.session_parts || [],
    startTime: cloudSession.start_time,
    endTime: cloudSession.end_time,
    totalDuration: cloudSession.total_duration || 0,
    ballRollingTime: cloudSession.ball_rolling_time || 0,
    ballNotRollingTime: cloudSession.ball_not_rolling_time || 0,
    ballRolling: false,
    activePartId: cloudSession.session_parts?.[0]?.id || null,
    events: cloudSession.events || [],
    ballRollingLog: cloudSession.ball_rolling_log || [],
    observerReflections: cloudSession.observer_reflections || [],
    coachReflections: cloudSession.coach_reflections || [],
    sessionNotes: cloudSession.session_notes || '',
    aiSummary: cloudSession.ai_summary || '',
    attachments: cloudSession.attachments || []
  };
};

/**
 * Initialize sync listeners for online/offline events
 */
export const initCloudSync = () => {
  window.addEventListener('online', () => {
    console.log('[CloudSync] Back online');
    setSyncStatus(SyncStatus.IDLE);
  });
  
  window.addEventListener('offline', () => {
    console.log('[CloudSync] Gone offline');
    setSyncStatus(SyncStatus.OFFLINE);
  });
  
  // Initial status
  if (!navigator.onLine) {
    setSyncStatus(SyncStatus.OFFLINE);
  }
};
