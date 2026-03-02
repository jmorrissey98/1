// Scheduled Sessions Offline Cache
// Caches all scheduled sessions for offline access with 24-hour validity

const CACHE_KEY = 'mcd_scheduled_sessions_cache';
const CACHE_TIMESTAMP_KEY = 'mcd_scheduled_sessions_cache_timestamp';
const CACHE_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached scheduled sessions
 * @returns {Object} { sessions: [], timestamp: string, isValid: boolean }
 */
export const getCachedScheduledSessions = () => {
  try {
    const sessionsData = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!sessionsData || !timestamp) {
      return { sessions: [], timestamp: null, isValid: false };
    }
    
    const sessions = JSON.parse(sessionsData);
    const cacheTime = new Date(timestamp).getTime();
    const now = Date.now();
    const isValid = (now - cacheTime) < CACHE_VALIDITY_MS;
    
    return { sessions, timestamp, isValid };
  } catch (e) {
    console.error('[ScheduledCache] Error reading cache:', e);
    return { sessions: [], timestamp: null, isValid: false };
  }
};

/**
 * Save scheduled sessions to cache
 * @param {Array} sessions - Array of session objects
 */
export const cacheScheduledSessions = (sessions) => {
  try {
    const timestamp = new Date().toISOString();
    localStorage.setItem(CACHE_KEY, JSON.stringify(sessions));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp);
    console.log(`[ScheduledCache] Cached ${sessions.length} sessions at ${timestamp}`);
  } catch (e) {
    console.error('[ScheduledCache] Error saving cache:', e);
  }
};

/**
 * Clear the scheduled sessions cache
 */
export const clearScheduledSessionsCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    console.log('[ScheduledCache] Cache cleared');
  } catch (e) {
    console.error('[ScheduledCache] Error clearing cache:', e);
  }
};

/**
 * Check if cache needs refresh
 * @returns {boolean}
 */
export const isCacheStale = () => {
  const { isValid } = getCachedScheduledSessions();
  return !isValid;
};

/**
 * Get a specific session from cache by ID
 * @param {string} sessionId 
 * @returns {Object|null}
 */
export const getCachedSessionById = (sessionId) => {
  const { sessions } = getCachedScheduledSessions();
  return sessions.find(s => s.session_id === sessionId || s.id === sessionId) || null;
};

/**
 * Update a specific session in cache
 * @param {string} sessionId 
 * @param {Object} updatedSession 
 */
export const updateCachedSession = (sessionId, updatedSession) => {
  const { sessions, timestamp, isValid } = getCachedScheduledSessions();
  if (!isValid) return;
  
  const index = sessions.findIndex(s => s.session_id === sessionId || s.id === sessionId);
  if (index >= 0) {
    sessions[index] = { ...sessions[index], ...updatedSession };
    localStorage.setItem(CACHE_KEY, JSON.stringify(sessions));
  }
};

/**
 * Add a session to cache
 * @param {Object} session 
 */
export const addSessionToCache = (session) => {
  const { sessions, isValid } = getCachedScheduledSessions();
  if (!isValid) {
    // Start fresh cache if invalid
    cacheScheduledSessions([session]);
  } else {
    sessions.push(session);
    localStorage.setItem(CACHE_KEY, JSON.stringify(sessions));
  }
};

/**
 * Remove a session from cache
 * @param {string} sessionId 
 */
export const removeSessionFromCache = (sessionId) => {
  const { sessions, isValid } = getCachedScheduledSessions();
  if (!isValid) return;
  
  const filtered = sessions.filter(s => s.session_id !== sessionId && s.id !== sessionId);
  localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
};
