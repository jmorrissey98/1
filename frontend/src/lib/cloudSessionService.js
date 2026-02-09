// Cloud Session Service - Handles all session data sync with the cloud database
import { safeGet, safePost, safePut, safeDelete } from './safeFetch';

const API_URL = '';

// Sync status management
let syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error', 'offline', 'conflict'
let lastSyncTime = null;
let pendingChanges = []; // Queue of changes made while offline
const syncListeners = new Set();

// Local storage keys for offline queue
const OFFLINE_QUEUE_KEY = 'mcd_offline_queue';
const OFFLINE_SESSIONS_KEY = 'mcd_offline_sessions';

export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ERROR: 'error',
  OFFLINE: 'offline',
  CONFLICT: 'conflict'
};

export const getSyncStatus = () => syncStatus;
export const getLastSyncTime = () => lastSyncTime;
export const getPendingChanges = () => pendingChanges;

export const addSyncListener = (listener) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const notifySyncListeners = (extra = {}) => {
  syncListeners.forEach(listener => listener({ 
    status: syncStatus, 
    lastSync: lastSyncTime,
    pendingCount: pendingChanges.length,
    ...extra 
  }));
  window.dispatchEvent(new CustomEvent('cloudSyncStatusChange', { 
    detail: { status: syncStatus, lastSync: lastSyncTime, pendingCount: pendingChanges.length, ...extra } 
  }));
};

const setSyncStatus = (status, extra = {}) => {
  syncStatus = status;
  if (status === SyncStatus.SYNCED) {
    lastSyncTime = new Date().toISOString();
  }
  notifySyncListeners(extra);
};

// ============================================
// OFFLINE QUEUE MANAGEMENT
// ============================================

/**
 * Load pending changes from localStorage
 */
const loadOfflineQueue = () => {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    pendingChanges = queue ? JSON.parse(queue) : [];
  } catch (e) {
    console.error('[CloudSync] Failed to load offline queue:', e);
    pendingChanges = [];
  }
};

/**
 * Save pending changes to localStorage
 */
const saveOfflineQueue = () => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(pendingChanges));
  } catch (e) {
    console.error('[CloudSync] Failed to save offline queue:', e);
  }
};

/**
 * Add a change to the offline queue
 */
const queueOfflineChange = (action, sessionId, data) => {
  const change = {
    id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    action, // 'create', 'update', 'delete'
    sessionId,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0
  };
  
  // Remove any previous changes for the same session (keep only latest)
  pendingChanges = pendingChanges.filter(c => c.sessionId !== sessionId || c.action === 'delete');
  pendingChanges.push(change);
  saveOfflineQueue();
  
  console.log(`[CloudSync] Queued offline change: ${action} for ${sessionId}`);
  return change;
};

/**
 * Process the offline queue when back online
 */
export const processOfflineQueue = async () => {
  if (!navigator.onLine || pendingChanges.length === 0) {
    return { processed: 0, failed: 0, conflicts: [] };
  }
  
  console.log(`[CloudSync] Processing ${pendingChanges.length} offline changes...`);
  setSyncStatus(SyncStatus.SYNCING);
  
  const results = { processed: 0, failed: 0, conflicts: [] };
  const changesToProcess = [...pendingChanges];
  
  for (const change of changesToProcess) {
    try {
      if (change.action === 'delete') {
        // Deletes are straightforward - just delete
        const result = await safeDelete(`${API_URL}/api/observations/${change.sessionId}`);
        if (result.ok || result.status === 404) {
          // Success or already deleted
          pendingChanges = pendingChanges.filter(c => c.id !== change.id);
          results.processed++;
        } else {
          results.failed++;
        }
      } else {
        // For create/update, check for conflicts
        const conflictResult = await resolveConflict(change);
        
        if (conflictResult.resolved) {
          pendingChanges = pendingChanges.filter(c => c.id !== change.id);
          results.processed++;
        } else if (conflictResult.conflict) {
          results.conflicts.push(conflictResult);
        } else {
          results.failed++;
        }
      }
    } catch (e) {
      console.error(`[CloudSync] Failed to process change ${change.id}:`, e);
      change.retryCount++;
      results.failed++;
    }
  }
  
  saveOfflineQueue();
  
  if (results.conflicts.length > 0) {
    setSyncStatus(SyncStatus.CONFLICT, { conflicts: results.conflicts });
  } else if (pendingChanges.length === 0) {
    setSyncStatus(SyncStatus.SYNCED);
  } else {
    setSyncStatus(SyncStatus.ERROR);
  }
  
  console.log(`[CloudSync] Queue processing complete:`, results);
  return results;
};

/**
 * Resolve a conflict between local and cloud data
 * Strategy: Last-write-wins based on timestamp, with option to keep both
 */
const resolveConflict = async (change) => {
  const { sessionId, data, timestamp } = change;
  
  // Fetch current cloud version
  const cloudResult = await safeGet(`${API_URL}/api/observations/${sessionId}`);
  
  if (cloudResult.networkError) {
    return { resolved: false, error: 'network' };
  }
  
  // If session doesn't exist in cloud, just create it
  if (!cloudResult.ok || cloudResult.status === 404) {
    const createResult = await safePost(`${API_URL}/api/observations`, mapToApiFormat(data));
    return { resolved: createResult.ok, error: createResult.ok ? null : 'create_failed' };
  }
  
  const cloudSession = cloudResult.data;
  const cloudUpdatedAt = new Date(cloudSession.updated_at);
  const localUpdatedAt = new Date(timestamp);
  
  // Compare timestamps
  if (localUpdatedAt >= cloudUpdatedAt) {
    // Local is newer or same - push local changes
    console.log(`[CloudSync] Local version is newer for ${sessionId}, pushing to cloud`);
    const updateResult = await safePost(`${API_URL}/api/observations`, mapToApiFormat(data));
    return { resolved: updateResult.ok, error: updateResult.ok ? null : 'update_failed' };
  } else {
    // Cloud is newer - check if there are actual conflicts
    const localEvents = data.events?.length || 0;
    const cloudEvents = cloudSession.events?.length || 0;
    
    if (localEvents > cloudEvents) {
      // Local has more events - merge by keeping local events
      console.log(`[CloudSync] Merging: local has more events (${localEvents} vs ${cloudEvents})`);
      const merged = mergeSessionData(data, cloudToLocalSession(cloudSession));
      const mergeResult = await safePost(`${API_URL}/api/observations`, mapToApiFormat(merged));
      return { resolved: mergeResult.ok, merged: true };
    } else {
      // Cloud version is authoritative - discard local changes
      console.log(`[CloudSync] Cloud version is newer for ${sessionId}, discarding local changes`);
      return { resolved: true, usedCloud: true };
    }
  }
};

/**
 * Merge two session versions, preferring more complete data
 */
const mergeSessionData = (local, cloud) => {
  return {
    ...cloud,
    // Keep local events if more
    events: (local.events?.length || 0) >= (cloud.events?.length || 0) ? local.events : cloud.events,
    // Keep longer ball rolling log
    ballRollingLog: (local.ballRollingLog?.length || 0) >= (cloud.ballRollingLog?.length || 0) 
      ? local.ballRollingLog : cloud.ballRollingLog,
    // Keep local duration if higher
    totalDuration: Math.max(local.totalDuration || 0, cloud.totalDuration || 0),
    ballRollingTime: Math.max(local.ballRollingTime || 0, cloud.ballRollingTime || 0),
    ballNotRollingTime: Math.max(local.ballNotRollingTime || 0, cloud.ballNotRollingTime || 0),
    // Keep local reflections and notes
    observerReflections: [...(cloud.observerReflections || []), ...(local.observerReflections || [])].filter(
      (r, i, arr) => arr.findIndex(x => x.id === r.id) === i
    ),
    sessionNotes: local.sessionNotes || cloud.sessionNotes,
    // Use latest timestamp
    updatedAt: new Date().toISOString()
  };
};

/**
 * Map frontend session format to API format
 */
const mapToApiFormat = (session) => ({
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
});

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
 * If offline, queues the change for later sync
 */
export const saveCloudSession = async (session) => {
  // Always save to localStorage for offline backup
  try {
    const sessions = JSON.parse(localStorage.getItem(OFFLINE_SESSIONS_KEY) || '{}');
    sessions[session.id] = { ...session, localUpdatedAt: new Date().toISOString() };
    localStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('[CloudSync] Failed to save to localStorage:', e);
  }

  if (!navigator.onLine) {
    // Queue for later sync
    queueOfflineChange('update', session.id, session);
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline', queued: true };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    const payload = mapToApiFormat(session);
    const result = await safePost(`${API_URL}/api/observations`, payload);
    
    if (result.networkError) {
      // Queue for later sync
      queueOfflineChange('update', session.id, session);
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network', queued: true };
    }
    
    if (!result.ok) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Failed to save' };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true, synced_at: result.data?.synced_at };
  } catch (error) {
    // Queue for later sync on any error
    queueOfflineChange('update', session.id, session);
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message, queued: true };
  }
};

/**
 * Delete a session from the cloud
 * If offline, queues the deletion for later sync
 */
export const deleteCloudSession = async (sessionId) => {
  // Remove from localStorage
  try {
    const sessions = JSON.parse(localStorage.getItem(OFFLINE_SESSIONS_KEY) || '{}');
    delete sessions[sessionId];
    localStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('[CloudSync] Failed to remove from localStorage:', e);
  }

  if (!navigator.onLine) {
    queueOfflineChange('delete', sessionId, null);
    setSyncStatus(SyncStatus.OFFLINE);
    return { success: false, error: 'offline', queued: true };
  }

  setSyncStatus(SyncStatus.SYNCING);
  
  try {
    const result = await safeDelete(`${API_URL}/api/observations/${sessionId}`);
    
    if (result.networkError) {
      queueOfflineChange('delete', sessionId, null);
      setSyncStatus(SyncStatus.OFFLINE);
      return { success: false, error: 'network', queued: true };
    }
    
    if (!result.ok && result.status !== 404) {
      setSyncStatus(SyncStatus.ERROR);
      return { success: false, error: result.data?.detail || 'Failed to delete' };
    }
    
    setSyncStatus(SyncStatus.SYNCED);
    return { success: true };
  } catch (error) {
    queueOfflineChange('delete', sessionId, null);
    setSyncStatus(SyncStatus.ERROR);
    return { success: false, error: error.message, queued: true };
  }
};
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
