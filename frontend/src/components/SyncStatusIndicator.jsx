import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { getPendingChangeCount, processOfflineQueue } from '../lib/cloudSessionService';
import { cn } from '../lib/utils';

export default function SyncStatusIndicator({ className, showDetails = false }) {
  const { syncStatus, lastSyncTime, isSyncing, isSynced, isOffline, hasError } = useCloudSync();
  const [pendingCount, setPendingCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update pending count periodically
  useEffect(() => {
    const updateCount = () => setPendingCount(getPendingChangeCount());
    updateCount();
    
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatLastSync = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

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

  const isConflict = syncStatus === 'conflict';

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {(isSyncing || isProcessing) && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-blue-600">Syncing...</span>
        </>
      )}
      
      {isSynced && !isSyncing && !isProcessing && (
        <>
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">
            Saved {lastSyncTime && formatLastSync(lastSyncTime)}
          </span>
        </>
      )}
      
      {isOffline && (
        <>
          <CloudOff className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-600">
            Offline{pendingCount > 0 && ` (${pendingCount} pending)`}
          </span>
        </>
      )}
      
      {isConflict && (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-orange-600">Conflicts resolved</span>
        </>
      )}
      
      {hasError && !isOffline && (
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
      
      {syncStatus === 'idle' && !isSyncing && !isProcessing && (
        <>
          <Cloud className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Cloud</span>
        </>
      )}
      
      {/* Show pending badge when online with pending changes */}
      {pendingCount > 0 && navigator.onLine && !isOffline && !isSyncing && !isProcessing && showDetails && (
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
