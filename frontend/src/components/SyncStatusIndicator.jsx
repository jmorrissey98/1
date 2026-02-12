import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPendingChangeCount, processOfflineQueue, getSyncStatus, SyncStatus } from '../lib/cloudSessionService';
import { cn } from '../lib/utils';

export default function SyncStatusIndicator({ className, showDetails = false }) {
  const { isCoach } = useAuth();
  const isCoachUser = isCoach && isCoach();
  
  const [pendingCount, setPendingCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [currentSyncStatus, setCurrentSyncStatus] = useState(getSyncStatus());
  
  // Update pending count and sync status periodically
  useEffect(() => {
    const updateCount = () => {
      setPendingCount(getPendingChangeCount());
      setCurrentSyncStatus(getSyncStatus());
    };
    updateCount();
    
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Listen to online/offline events
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

  const handleSyncNow = async () => {
    if (!navigator.onLine || isProcessing) return;
    setIsProcessing(true);
    try {
      await processOfflineQueue();
      setPendingCount(getPendingChangeCount());
    } finally {
      setIsProcessing(false);
    }
  };
  
  // For coach users, show a simple online/offline indicator
  if (isCoachUser) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs", className)}>
        {online ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-600">Synced</span>
          </>
        ) : (
          <>
            <CloudOff className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-amber-600">Offline</span>
          </>
        )}
      </div>
    );
  }
  
  // For coach developers, show full sync status
  const isSyncing = currentSyncStatus === SyncStatus.SYNCING || isProcessing;
  const isSynced = currentSyncStatus === SyncStatus.SYNCED;
  const isOffline = currentSyncStatus === SyncStatus.OFFLINE || !online;
  const hasError = currentSyncStatus === SyncStatus.ERROR;
  const isConflict = currentSyncStatus === SyncStatus.CONFLICT;

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {isSyncing && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-blue-600">Syncing...</span>
        </>
      )}
      
      {isSynced && !isSyncing && (
        <>
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      
      {isOffline && !isSyncing && (
        <>
          <CloudOff className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-600">
            Offline{pendingCount > 0 && ` (${pendingCount} pending)`}
          </span>
        </>
      )}
      
      {isConflict && !isSyncing && (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-orange-600">Conflicts resolved</span>
        </>
      )}
      
      {hasError && !isOffline && !isSyncing && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-600">
            Sync failed{pendingCount > 0 && ` (${pendingCount} pending)`}
          </span>
          {pendingCount > 0 && navigator.onLine && (
            <button 
              onClick={handleSyncNow}
              className="ml-1 p-0.5 hover:bg-slate-100 rounded"
              title="Retry sync"
            >
              <RefreshCw className="w-3 h-3 text-red-500" />
            </button>
          )}
        </>
      )}
      
      {currentSyncStatus === 'idle' && !isSyncing && (
        <>
          <Cloud className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Cloud</span>
        </>
      )}
      
      {/* Show pending badge when online with pending changes */}
      {pendingCount > 0 && navigator.onLine && !isOffline && !isSyncing && showDetails && (
        <button 
          onClick={handleSyncNow}
          className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
        >
          Sync {pendingCount}
        </button>
      )}
    </div>
  );
}
