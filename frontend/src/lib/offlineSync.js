// Offline Sync System for My Coach Developer
// Manages offline queue and automatic synchronization

const SYNC_QUEUE_KEY = 'mcd_sync_queue';
const SYNC_STATUS_KEY = 'mcd_sync_status';
const LAST_SYNC_KEY = 'mcd_last_sync';

// API base URL
const API_URL = ''; // Relative URL - frontend and backend on same domain

// Sync status enum
export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  OFFLINE: 'offline',
  ERROR: 'error',
  SYNCED: 'synced'
};

// Queue item types
export const QueueItemType = {
  CREATE_SESSION: 'create_session',
  UPDATE_SESSION: 'update_session',
  DELETE_SESSION: 'delete_session',
  CREATE_COACH: 'create_coach',
  UPDATE_COACH: 'update_coach',
  DELETE_COACH: 'delete_coach',
  CREATE_SESSION_PART: 'create_session_part',
  UPLOAD_FILE: 'upload_file'
};

// Get the offline queue
export const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[Sync] Error reading queue:', e);
    return [];
  }
};

// Save the offline queue
const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[Sync] Error saving queue:', e);
  }
};

// Add item to offline queue
export const addToOfflineQueue = (type, data, entityId) => {
  const queue = getOfflineQueue();
  
  // Check for existing item with same entity - use "most recent wins"
  const existingIndex = queue.findIndex(
    item => item.entityId === entityId && item.type === type
  );
  
  const queueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    data,
    entityId,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  };
  
  if (existingIndex >= 0) {
    // Replace existing item (most recent wins)
    queue[existingIndex] = queueItem;
  } else {
    queue.push(queueItem);
  }
  
  saveOfflineQueue(queue);
  updateSyncStatus(SyncStatus.OFFLINE);
  
  // Try to sync if online
  if (navigator.onLine) {
    triggerSync();
  }
  
  return queueItem;
};

// Remove item from queue
export const removeFromQueue = (itemId) => {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveOfflineQueue(filtered);
};

// Update item status in queue
const updateQueueItemStatus = (itemId, status, error = null) => {
  const queue = getOfflineQueue();
  const index = queue.findIndex(item => item.id === itemId);
  if (index >= 0) {
    queue[index].status = status;
    queue[index].lastError = error;
    queue[index].lastAttempt = new Date().toISOString();
    saveOfflineQueue(queue);
  }
};

// Get sync status
export const getSyncStatus = () => {
  try {
    return localStorage.getItem(SYNC_STATUS_KEY) || SyncStatus.IDLE;
  } catch {
    return SyncStatus.IDLE;
  }
};

// Update sync status
export const updateSyncStatus = (status) => {
  localStorage.setItem(SYNC_STATUS_KEY, status);
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('syncStatusChange', { detail: { status } }));
};

// Get last sync time
export const getLastSyncTime = () => {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) || null;
  } catch {
    return null;
  }
};

// Check if online
export const isOnline = () => navigator.onLine;

// Get pending sync count
export const getPendingSyncCount = () => {
  const queue = getOfflineQueue();
  return queue.filter(item => item.status === 'pending' || item.status === 'error').length;
};

// Process a single queue item
const processQueueItem = async (item) => {
  console.log('[Sync] Processing item:', item.type, item.entityId);
  
  try {
    let response;
    
    switch (item.type) {
      case QueueItemType.CREATE_SESSION_PART:
        response = await fetch(`${API_URL}/api/session-parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item.data)
        });
        break;
        
      // Add more cases as needed for other sync types
      // For now, most data is stored locally, so we primarily sync session parts
      
      default:
        console.log('[Sync] Unknown item type:', item.type);
        return { success: true, skipped: true };
    }
    
    if (response && response.ok) {
      return { success: true, data: await response.json() };
    } else if (response) {
      const error = await response.text();
      return { success: false, error };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('[Sync] Error processing item:', error);
    return { success: false, error: error.message };
  }
};

// Main sync function
export const syncOfflineData = async () => {
  if (!navigator.onLine) {
    console.log('[Sync] Cannot sync - offline');
    updateSyncStatus(SyncStatus.OFFLINE);
    return { success: false, reason: 'offline' };
  }
  
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    console.log('[Sync] Queue is empty');
    updateSyncStatus(SyncStatus.SYNCED);
    return { success: true, synced: 0 };
  }
  
  console.log('[Sync] Starting sync, items:', queue.length);
  updateSyncStatus(SyncStatus.SYNCING);
  
  let syncedCount = 0;
  let errorCount = 0;
  
  // Process items in order (oldest first)
  const sortedQueue = [...queue].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  for (const item of sortedQueue) {
    if (item.status === 'synced') continue;
    
    const result = await processQueueItem(item);
    
    if (result.success) {
      removeFromQueue(item.id);
      syncedCount++;
    } else {
      // Update retry count
      item.retryCount = (item.retryCount || 0) + 1;
      
      if (item.retryCount >= 3) {
        updateQueueItemStatus(item.id, 'failed', result.error);
      } else {
        updateQueueItemStatus(item.id, 'error', result.error);
      }
      errorCount++;
    }
  }
  
  // Update last sync time
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  
  // Update status
  const remainingQueue = getOfflineQueue();
  if (remainingQueue.length === 0) {
    updateSyncStatus(SyncStatus.SYNCED);
  } else if (errorCount > 0) {
    updateSyncStatus(SyncStatus.ERROR);
  } else {
    updateSyncStatus(SyncStatus.IDLE);
  }
  
  console.log('[Sync] Sync complete:', { syncedCount, errorCount });
  
  return { success: true, synced: syncedCount, errors: errorCount };
};

// Trigger sync (debounced)
let syncTimeout = null;
export const triggerSync = () => {
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(() => {
    syncOfflineData();
  }, 1000); // Debounce 1 second
};

// Register for background sync
export const registerBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-offline-data');
      console.log('[Sync] Background sync registered');
    } catch (error) {
      console.log('[Sync] Background sync not supported:', error);
    }
  }
};

// Listen for online/offline events
export const initSyncListeners = () => {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online, triggering sync');
    updateSyncStatus(SyncStatus.IDLE);
    triggerSync();
  });
  
  window.addEventListener('offline', () => {
    console.log('[Sync] Gone offline');
    updateSyncStatus(SyncStatus.OFFLINE);
  });
  
  // Listen for service worker messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC') {
        syncOfflineData();
      }
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        window.dispatchEvent(new CustomEvent('syncComplete'));
      }
    });
  }
  
  // Initial status check
  if (!navigator.onLine) {
    updateSyncStatus(SyncStatus.OFFLINE);
  } else {
    const queue = getOfflineQueue();
    if (queue.length > 0) {
      triggerSync();
    }
  }
};

// Clear sync queue (for debugging/reset)
export const clearSyncQueue = () => {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  updateSyncStatus(SyncStatus.IDLE);
};
