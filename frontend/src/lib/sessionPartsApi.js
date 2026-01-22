// Session Parts API - fetches from backend for shared defaults
// With offline-first support
import { addToOfflineQueue, QueueItemType, isOnline } from './offlineSync';

const API_URL = ''; // Relative URL - frontend and backend on same domain

// Fallback defaults when backend is unavailable
const FALLBACK_SESSION_PARTS = [
  { part_id: 'default_technique', name: 'Develop The Technique', is_default: true },
  { part_id: 'default_game_model', name: 'Develop The Game Model', is_default: true },
  { part_id: 'default_performance', name: 'Develop Performance', is_default: true },
  { part_id: 'default_mentality', name: 'Develop Mentality', is_default: true }
];

// Cache key for local storage
const CACHE_KEY = 'mcd_session_parts_cache';

// Get cached parts
const getCachedParts = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Cache valid for 5 minutes
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        return data.parts;
      }
    }
  } catch (e) {
    console.error('Error reading session parts cache:', e);
  }
  return null;
};

// Set cache
const setCachedParts = (parts) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      parts,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Error caching session parts:', e);
  }
};

// Fetch all session parts (defaults + custom)
export const fetchSessionParts = async () => {
  // Try cache first
  const cached = getCachedParts();
  if (cached) return cached;

  try {
    const response = await fetch(`${API_URL}/api/session-parts`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const parts = await response.json();
      setCachedParts(parts);
      return parts;
    }
  } catch (err) {
    console.error('Failed to fetch session parts:', err);
  }
  
  // Return fallback defaults
  return FALLBACK_SESSION_PARTS;
};

// Fetch only default session parts
export const fetchDefaultSessionParts = async () => {
  try {
    const response = await fetch(`${API_URL}/api/session-parts/defaults`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error('Failed to fetch default session parts:', err);
  }
  
  return FALLBACK_SESSION_PARTS;
};

// Create a new session part
export const createSessionPart = async (name, isDefault = false) => {
  const partData = { name, is_default: isDefault };
  
  // If offline, queue the request and return a local version
  if (!isOnline()) {
    const localPart = {
      part_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      is_default: isDefault,
      created_at: new Date().toISOString(),
      pending_sync: true
    };
    
    // Add to offline queue
    addToOfflineQueue(
      QueueItemType.CREATE_SESSION_PART,
      partData,
      localPart.part_id
    );
    
    // Store locally in cache
    const cached = getCachedParts();
    if (cached) {
      setCachedParts([...cached, localPart]);
    }
    
    return localPart;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/session-parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(partData)
    });
    
    if (response.ok) {
      // Clear cache to refresh
      localStorage.removeItem(CACHE_KEY);
      return await response.json();
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create session part');
    }
  } catch (err) {
    // If network error, queue for offline sync
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      const localPart = {
        part_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        is_default: isDefault,
        created_at: new Date().toISOString(),
        pending_sync: true
      };
      
      addToOfflineQueue(
        QueueItemType.CREATE_SESSION_PART,
        partData,
        localPart.part_id
      );
      
      return localPart;
    }
    
    console.error('Failed to create session part:', err);
    throw err;
  }
};

// Delete a session part (Coach Developer only)
export const deleteSessionPart = async (partId) => {
  try {
    const response = await fetch(`${API_URL}/api/session-parts/${partId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Clear cache to refresh
      localStorage.removeItem(CACHE_KEY);
      return true;
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete session part');
    }
  } catch (err) {
    console.error('Failed to delete session part:', err);
    throw err;
  }
};

// Clear the session parts cache (call after creating/deleting)
export const clearSessionPartsCache = () => {
  localStorage.removeItem(CACHE_KEY);
};

// Convert backend part format to frontend format
export const toFrontendFormat = (backendPart, order = 0) => ({
  id: backendPart.part_id,
  name: backendPart.name,
  order,
  isDefault: backendPart.is_default,
  createdBy: backendPart.created_by
});

// Convert frontend part format to backend format
export const toBackendFormat = (frontendPart) => ({
  part_id: frontendPart.id,
  name: frontendPart.name,
  is_default: frontendPart.isDefault || false
});
