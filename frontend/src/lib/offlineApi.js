// Offline-capable API wrapper
// Provides offline-first data access with automatic sync

import { addToOfflineQueue, QueueItemType, isOnline, triggerSync } from './offlineSync';
import { safeGet, safePost, safePut } from './safeFetch';

const API_URL = '';

// Local storage keys
const STORAGE_KEYS = {
  COACH_PROFILE: 'mcd_coach_profile',
  COACH_SESSIONS: 'mcd_coach_sessions',
  COACH_REFLECTIONS: 'mcd_coach_reflections',
  COACH_TARGETS: 'mcd_coach_targets',
  COACH_DASHBOARD: 'mcd_coach_dashboard',
  SESSIONS: 'mcd_sessions',
  COACHES: 'mcd_coaches'
};

// Helper to get cached data
const getCached = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error(`[OfflineAPI] Error reading cache ${key}:`, e);
    return null;
  }
};

// Helper to set cached data with timestamp
const setCached = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      cached: true
    }));
  } catch (e) {
    console.error(`[OfflineAPI] Error writing cache ${key}:`, e);
  }
};

// Check if cache is valid (within TTL)
const isCacheValid = (cached, ttlMs = 5 * 60 * 1000) => {
  if (!cached || !cached.timestamp) return false;
  return Date.now() - cached.timestamp < ttlMs;
};

// ============================================
// COACH PROFILE OPERATIONS
// ============================================

export const fetchCoachProfile = async () => {
  const cached = getCached(STORAGE_KEYS.COACH_PROFILE);
  
  if (!isOnline()) {
    if (cached?.data) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    return { ok: false, error: 'Offline and no cached data' };
  }
  
  const result = await safeGet(`${API_URL}/api/coach/profile`);
  
  if (result.ok && result.data) {
    setCached(STORAGE_KEYS.COACH_PROFILE, result.data);
  } else if (cached?.data) {
    // Return cached data on error
    return { ok: true, data: cached.data, fromCache: true };
  }
  
  return result;
};

export const updateCoachProfile = async (profileData) => {
  // Always update local cache first
  const cached = getCached(STORAGE_KEYS.COACH_PROFILE);
  const updatedProfile = { ...(cached?.data || {}), ...profileData };
  setCached(STORAGE_KEYS.COACH_PROFILE, updatedProfile);
  
  if (!isOnline()) {
    // Queue for sync
    addToOfflineQueue(
      QueueItemType.UPDATE_COACH_PROFILE,
      profileData,
      'coach_profile'
    );
    return { ok: true, data: updatedProfile, queued: true };
  }
  
  const result = await safePut(`${API_URL}/api/coach/profile`, profileData);
  
  if (result.ok && result.data) {
    setCached(STORAGE_KEYS.COACH_PROFILE, result.data);
  }
  
  return result;
};

// ============================================
// COACH DASHBOARD
// ============================================

export const fetchCoachDashboard = async () => {
  const cached = getCached(STORAGE_KEYS.COACH_DASHBOARD);
  
  if (!isOnline()) {
    if (cached?.data) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    return { ok: false, error: 'Offline and no cached data' };
  }
  
  const result = await safeGet(`${API_URL}/api/coach/dashboard`);
  
  if (result.ok && result.data) {
    setCached(STORAGE_KEYS.COACH_DASHBOARD, result.data);
  } else if (cached?.data) {
    return { ok: true, data: cached.data, fromCache: true };
  }
  
  return result;
};

// ============================================
// COACH SESSIONS
// ============================================

export const fetchCoachSessions = async () => {
  const cached = getCached(STORAGE_KEYS.COACH_SESSIONS);
  
  if (!isOnline()) {
    if (cached?.data) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    return { ok: true, data: [], fromCache: true };
  }
  
  const result = await safeGet(`${API_URL}/api/coach/sessions`);
  
  if (result.ok && result.data) {
    setCached(STORAGE_KEYS.COACH_SESSIONS, result.data);
  } else if (cached?.data) {
    return { ok: true, data: cached.data, fromCache: true };
  }
  
  return result;
};

export const fetchCoachSession = async (sessionId) => {
  const cacheKey = `${STORAGE_KEYS.COACH_SESSIONS}_${sessionId}`;
  const cached = getCached(cacheKey);
  
  if (!isOnline()) {
    if (cached?.data) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    return { ok: false, error: 'Offline and no cached data' };
  }
  
  const result = await safeGet(`${API_URL}/api/coach/session/${sessionId}`);
  
  if (result.ok && result.data) {
    setCached(cacheKey, result.data);
  } else if (cached?.data) {
    return { ok: true, data: cached.data, fromCache: true };
  }
  
  return result;
};

// ============================================
// REFLECTIONS
// ============================================

export const createReflection = async (reflectionData) => {
  // Generate local ID for offline
  const localId = `ref_local_${Date.now()}`;
  const localReflection = {
    ...reflectionData,
    reflection_id: localId,
    created_at: new Date().toISOString(),
    pending_sync: true
  };
  
  if (!isOnline()) {
    // Store locally
    const cachedSessions = getCached(STORAGE_KEYS.COACH_SESSIONS);
    if (cachedSessions?.data) {
      // Update the session with the new reflection
      const sessions = cachedSessions.data.map(s => {
        if (s.session_id === reflectionData.session_id) {
          return { ...s, reflection: localReflection };
        }
        return s;
      });
      setCached(STORAGE_KEYS.COACH_SESSIONS, sessions);
    }
    
    // Queue for sync
    addToOfflineQueue(
      QueueItemType.CREATE_REFLECTION,
      reflectionData,
      localId
    );
    
    return { ok: true, data: localReflection, queued: true };
  }
  
  const result = await safePost(`${API_URL}/api/coach/reflections`, reflectionData);
  
  if (result.ok) {
    // Invalidate cache to refresh
    localStorage.removeItem(STORAGE_KEYS.COACH_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.COACH_DASHBOARD);
  }
  
  return result;
};

export const updateReflection = async (reflectionId, reflectionData) => {
  if (!isOnline()) {
    // Queue for sync
    addToOfflineQueue(
      QueueItemType.UPDATE_REFLECTION,
      reflectionData,
      reflectionId
    );
    
    return { ok: true, data: { ...reflectionData, reflection_id: reflectionId }, queued: true };
  }
  
  const result = await safePut(`${API_URL}/api/coach/reflections/${reflectionId}`, reflectionData);
  
  if (result.ok) {
    localStorage.removeItem(STORAGE_KEYS.COACH_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.COACH_DASHBOARD);
  }
  
  return result;
};

// ============================================
// COACHES (Admin operations)
// ============================================

export const fetchCoaches = async () => {
  const cached = getCached(STORAGE_KEYS.COACHES);
  
  if (!isOnline()) {
    if (cached?.data) {
      return { ok: true, data: cached.data, fromCache: true };
    }
    return { ok: true, data: [], fromCache: true };
  }
  
  const result = await safeGet(`${API_URL}/api/coaches`);
  
  if (result.ok && result.data) {
    setCached(STORAGE_KEYS.COACHES, result.data);
  } else if (cached?.data) {
    return { ok: true, data: cached.data, fromCache: true };
  }
  
  return result;
};

export const updateCoach = async (coachId, coachData) => {
  // Update local cache
  const cached = getCached(STORAGE_KEYS.COACHES);
  if (cached?.data) {
    const coaches = cached.data.map(c => 
      c.id === coachId ? { ...c, ...coachData } : c
    );
    setCached(STORAGE_KEYS.COACHES, coaches);
  }
  
  if (!isOnline()) {
    addToOfflineQueue(
      QueueItemType.UPDATE_COACH,
      coachData,
      coachId
    );
    return { ok: true, data: { id: coachId, ...coachData }, queued: true };
  }
  
  const result = await safePut(`${API_URL}/api/coaches/${coachId}`, coachData);
  
  if (result.ok) {
    localStorage.removeItem(STORAGE_KEYS.COACHES);
  }
  
  return result;
};

export const updateCoachTargets = async (coachId, targets) => {
  // Update local cache
  const cached = getCached(STORAGE_KEYS.COACHES);
  if (cached?.data) {
    const coaches = cached.data.map(c => 
      c.id === coachId ? { ...c, targets } : c
    );
    setCached(STORAGE_KEYS.COACHES, coaches);
  }
  
  if (!isOnline()) {
    addToOfflineQueue(
      QueueItemType.UPDATE_COACH_TARGETS,
      { targets },
      coachId
    );
    return { ok: true, data: { targets }, queued: true };
  }
  
  const result = await safePut(`${API_URL}/api/coaches/${coachId}/targets`, { targets });
  
  if (result.ok) {
    localStorage.removeItem(STORAGE_KEYS.COACHES);
  }
  
  return result;
};

// ============================================
// SESSIONS (Local storage with backend sync)
// ============================================

const SESSIONS_KEY = 'coachObserverSessions';

export const getLocalSessions = () => {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[OfflineAPI] Error reading local sessions:', e);
    return [];
  }
};

export const saveLocalSession = (session) => {
  try {
    const sessions = getLocalSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...sessions[existingIndex], ...session, updated_at: new Date().toISOString() };
    } else {
      sessions.unshift({ ...session, created_at: new Date().toISOString() });
    }
    
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    
    // If online, try to sync immediately
    if (isOnline()) {
      triggerSync();
    }
    
    return session;
  } catch (e) {
    console.error('[OfflineAPI] Error saving local session:', e);
    return session;
  }
};

export const deleteLocalSession = (sessionId) => {
  try {
    const sessions = getLocalSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return true;
  } catch (e) {
    console.error('[OfflineAPI] Error deleting local session:', e);
    return false;
  }
};

// ============================================
// CACHE MANAGEMENT
// ============================================

export const clearAllCache = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

export const getCacheStatus = () => {
  const status = {};
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    const cached = getCached(key);
    status[name] = {
      exists: !!cached,
      age: cached?.timestamp ? Date.now() - cached.timestamp : null,
      valid: isCacheValid(cached)
    };
  });
  return status;
};

// Export for use in service worker
export const CACHE_KEYS = STORAGE_KEYS;
