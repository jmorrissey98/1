// Offline Status Indicator - shows sync status in a non-intrusive way
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useSync, SyncStatus } from '../contexts/SyncContext';
import { cn } from '../lib/utils';

export default function OfflineIndicator() {
  const { syncStatus, pendingCount, online, triggerManualSync, lastSync } = useSync();
  const [showDetails, setShowDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Auto-hide details after showing
  useEffect(() => {
    if (showDetails) {
      const timer = setTimeout(() => setShowDetails(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showDetails]);

  const handleClick = async () => {
    if (syncing) return;
    
    if (!online) {
      setShowDetails(true);
      return;
    }

    if (pendingCount > 0) {
      setSyncing(true);
      await triggerManualSync();
      setSyncing(false);
    } else {
      setShowDetails(!showDetails);
    }
  };

  // Don't show anything if online and synced with no pending
  if (online && pendingCount === 0 && syncStatus === SyncStatus.SYNCED) {
    return null;
  }

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusConfig = () => {
    if (!online) {
      return {
        icon: CloudOff,
        color: 'bg-amber-500',
        text: 'Offline',
        textColor: 'text-amber-600'
      };
    }
    
    if (syncing || syncStatus === SyncStatus.SYNCING) {
      return {
        icon: RefreshCw,
        color: 'bg-blue-500',
        text: 'Syncing...',
        textColor: 'text-blue-600',
        animate: true
      };
    }
    
    if (pendingCount > 0) {
      return {
        icon: Cloud,
        color: 'bg-amber-500',
        text: `${pendingCount} pending`,
        textColor: 'text-amber-600'
      };
    }
    
    if (syncStatus === SyncStatus.ERROR) {
      return {
        icon: AlertCircle,
        color: 'bg-red-500',
        text: 'Sync error',
        textColor: 'text-red-600'
      };
    }
    
    return {
      icon: Check,
      color: 'bg-green-500',
      text: 'Synced',
      textColor: 'text-green-600'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="fixed bottom-20 right-4 z-40" data-testid="offline-indicator">
      {/* Status Button */}
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all",
          "bg-white border border-slate-200 hover:shadow-xl",
          showDetails && "ring-2 ring-slate-300"
        )}
        aria-label="Sync status"
      >
        <span className={cn(
          "w-2 h-2 rounded-full",
          config.color
        )} />
        <Icon 
          className={cn(
            "w-4 h-4",
            config.textColor,
            config.animate && "animate-spin"
          )} 
        />
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.text}
        </span>
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Connection</span>
              <span className={cn(
                "text-sm font-medium",
                online ? "text-green-600" : "text-amber-600"
              )}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Pending</span>
              <span className="text-sm text-slate-600">{pendingCount} items</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Last sync</span>
              <span className="text-sm text-slate-600">{formatLastSync()}</span>
            </div>

            {!online && (
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Your changes are saved locally and will sync when you're back online.
              </p>
            )}

            {online && pendingCount > 0 && (
              <button
                onClick={handleClick}
                disabled={syncing}
                className="w-full mt-2 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
