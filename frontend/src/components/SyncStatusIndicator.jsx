import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { cn } from '../lib/utils';

export default function SyncStatusIndicator({ className }) {
  const { syncStatus, lastSyncTime, isSyncing, isSynced, isOffline, hasError } = useCloudSync();

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

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {isSyncing && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-blue-600">Syncing...</span>
        </>
      )}
      
      {isSynced && (
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
          <span className="text-amber-600">Offline</span>
        </>
      )}
      
      {hasError && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-600">Sync failed</span>
        </>
      )}
      
      {syncStatus === 'idle' && (
        <>
          <Cloud className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Cloud</span>
        </>
      )}
    </div>
  );
}
