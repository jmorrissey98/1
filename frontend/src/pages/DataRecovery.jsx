import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Download, Copy, CheckCircle, AlertTriangle, Database, HardDrive } from 'lucide-react';

// Storage keys from storage.js
const STORAGE_KEYS = {
  SESSIONS: 'mcd_sessions',
  TEMPLATES: 'mcd_templates',
  ACTIVE_SESSION: 'mcd_active_session',
  SETTINGS: 'mcd_settings',
  COACHES: 'mcd_coaches',
  CURRENT_USER: 'mcd_current_user',
  USERS: 'mcd_users',
  SESSION_PARTS_CACHE: 'mcd_session_parts_cache'
};

// Offline sync keys
const SYNC_KEYS = {
  SYNC_QUEUE: 'mcd_sync_queue',
  SYNC_STATUS: 'mcd_sync_status',
  LAST_SYNC: 'mcd_last_sync'
};

export default function DataRecovery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [localStorageData, setLocalStorageData] = useState(null);
  const [indexedDBData, setIndexedDBData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only allow access to specific user
  const ALLOWED_EMAIL = 'joemorrisseyg@gmail.com';

  useEffect(() => {
    if (user?.email !== ALLOWED_EMAIL) {
      navigate('/');
      return;
    }
    extractAllData();
  }, [user, navigate]);

  const extractLocalStorage = () => {
    const data = {};
    
    // Extract all MCD-related localStorage data
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          try {
            data[key] = JSON.parse(value);
          } catch {
            data[key] = value;
          }
        }
      } catch (e) {
        data[key] = { error: e.message };
      }
    });

    // Extract sync-related data
    Object.entries(SYNC_KEYS).forEach(([key, storageKey]) => {
      try {
        const value = localStorage.getItem(storageKey);
        if (value) {
          try {
            data[`SYNC_${key}`] = JSON.parse(value);
          } catch {
            data[`SYNC_${key}`] = value;
          }
        }
      } catch (e) {
        data[`SYNC_${key}`] = { error: e.message };
      }
    });

    // Also grab any other localStorage keys that might contain app data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mcd_') && !Object.values(STORAGE_KEYS).includes(key) && !Object.values(SYNC_KEYS).includes(key)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              data[`OTHER_${key}`] = JSON.parse(value);
            } catch {
              data[`OTHER_${key}`] = value;
            }
          }
        } catch (e) {
          data[`OTHER_${key}`] = { error: e.message };
        }
      }
    }

    return data;
  };

  const extractIndexedDB = async () => {
    const data = {};
    
    try {
      // Get all IndexedDB database names
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        
        for (const dbInfo of databases) {
          if (!dbInfo.name) continue;
          
          try {
            const dbData = await new Promise((resolve, reject) => {
              const request = indexedDB.open(dbInfo.name);
              
              request.onerror = () => reject(new Error(`Cannot open ${dbInfo.name}`));
              
              request.onsuccess = (event) => {
                const db = event.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                const dbContent = { stores: {} };
                
                if (storeNames.length === 0) {
                  db.close();
                  resolve(dbContent);
                  return;
                }
                
                let completed = 0;
                
                storeNames.forEach(storeName => {
                  try {
                    const transaction = db.transaction(storeName, 'readonly');
                    const store = transaction.objectStore(storeName);
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = () => {
                      dbContent.stores[storeName] = getAllRequest.result;
                      completed++;
                      if (completed === storeNames.length) {
                        db.close();
                        resolve(dbContent);
                      }
                    };
                    
                    getAllRequest.onerror = () => {
                      dbContent.stores[storeName] = { error: 'Failed to read' };
                      completed++;
                      if (completed === storeNames.length) {
                        db.close();
                        resolve(dbContent);
                      }
                    };
                  } catch (e) {
                    dbContent.stores[storeName] = { error: e.message };
                    completed++;
                    if (completed === storeNames.length) {
                      db.close();
                      resolve(dbContent);
                    }
                  }
                });
              };
            });
            
            data[dbInfo.name] = dbData;
          } catch (e) {
            data[dbInfo.name] = { error: e.message };
          }
        }
      }
    } catch (e) {
      data._error = e.message;
    }
    
    return data;
  };

  const extractAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract localStorage
      const lsData = extractLocalStorage();
      setLocalStorageData(lsData);
      
      // Extract IndexedDB
      const idbData = await extractIndexedDB();
      setIndexedDBData(idbData);
      
      // Combine all data
      const combined = {
        exportDate: new Date().toISOString(),
        exportedBy: user?.email,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        localStorage: lsData,
        indexedDB: idbData
      };
      
      setAllData(combined);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const jsonString = JSON.stringify(allData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(allData, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const downloadAsFile = () => {
    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-coach-developer-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Check authorization
  if (user?.email !== ALLOWED_EMAIL) {
    return null;
  }

  const sessionCount = localStorageData?.SESSIONS?.length || 0;
  const coachCount = localStorageData?.COACHES?.length || 0;
  const templateCount = localStorageData?.TEMPLATES?.length || 0;
  const syncQueueCount = localStorageData?.SYNC_SYNC_QUEUE?.length || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Data Recovery</h1>
            <p className="text-sm text-slate-500">Export your local data before migration</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Warning Banner */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Important: Save Your Data</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This tool extracts all your locally stored data. Copy or download this data before we migrate to the cloud database.
                  Once you confirm you have a backup, we can proceed with Phase 2.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{sessionCount}</div>
              <div className="text-sm text-slate-500">Sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">{coachCount}</div>
              <div className="text-sm text-slate-500">Coaches</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{templateCount}</div>
              <div className="text-sm text-slate-500">Templates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-orange-600">{syncQueueCount}</div>
              <div className="text-sm text-slate-500">Pending Syncs</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Export Local Data
            </CardTitle>
            <CardDescription>
              Click the buttons below to backup your data. We recommend using both methods.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={copyToClipboard} 
                disabled={loading || !allData}
                className="flex items-center gap-2"
                variant={copied ? "default" : "outline"}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              
              <Button 
                onClick={downloadAsFile} 
                disabled={loading || !allData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download as JSON File
              </Button>
              
              <Button 
                onClick={extractAllData} 
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <HardDrive className="h-4 w-4" />
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Raw Data Display */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Data Preview</CardTitle>
            <CardDescription>
              This is all the data stored locally on this device. Review it before copying.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-500">Extracting data...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                Error: {error}
              </div>
            ) : (
              <div className="relative">
                <pre 
                  className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono"
                  data-testid="raw-data-preview"
                >
                  {JSON.stringify(allData, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p><strong>1.</strong> Click "Copy to Clipboard" or "Download as JSON File" to save your data.</p>
            <p><strong>2.</strong> Store this backup in a safe place (email it to yourself, save to cloud drive, etc.).</p>
            <p><strong>3.</strong> Once you've confirmed the backup is saved, let me know and we'll proceed with Phase 2 (Database Integration).</p>
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Do not close this page until you have saved your backup!
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
