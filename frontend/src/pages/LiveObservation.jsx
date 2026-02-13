import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Undo2, Square, Circle, MessageSquare, Check, X, Plus, Loader2, ChevronDown, ChevronUp, Target, StickyNote, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { toast } from 'sonner';
import { createEvent } from '../lib/storage';
import { fetchSessionParts, createSessionPart } from '../lib/sessionPartsApi';
import { formatTime, cn, generateId } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { safeGet } from '../lib/safeFetch';
import SyncStatusIndicator from '../components/SyncStatusIndicator';

export default function LiveObservation() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { isCoachDeveloper } = useAuth();
  const { getSession, saveSession: cloudSaveSession, setCurrentSession, getCachedSession } = useCloudSync();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [flashEvent, setFlashEvent] = useState(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  
  // New part dialog state
  const [showAddPartDialog, setShowAddPartDialog] = useState(false);
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedDefaultPart, setSelectedDefaultPart] = useState('custom');
  const [customPartName, setCustomPartName] = useState('');
  const [addAsDefault, setAddAsDefault] = useState(false);
  const [savingPart, setSavingPart] = useState(false);
  
  // Coach info state (Phase 4)
  const [coachInfo, setCoachInfo] = useState(null);
  const [showCoachInfo, setShowCoachInfo] = useState(false);
  
  // Observer notes state (Phase 4)
  const [observerNotes, setObserverNotes] = useState([]);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  
  const timerRef = useRef(null);
  const lastBallStateChange = useRef(null);
  const partStartTime = useRef(null);

  // Load session from cloud (with cache support)
  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      
      // First check cache for immediate display
      const cached = getCachedSession(sessionId);
      if (cached) {
        setSession(cached);
        setCurrentSession(cached);
        // Resume if session was active
        if (cached.status === 'active' && cached.startTime) {
          const elapsed = Math.floor((Date.now() - new Date(cached.startTime).getTime()) / 1000);
          setElapsedTime(elapsed);
          setIsRunning(true);
        } else if (cached.totalDuration > 0) {
          setElapsedTime(cached.totalDuration);
        }
      }
      
      // Then fetch fresh data from cloud
      try {
        const loaded = await getSession(sessionId, !cached); // Force refresh if no cache
        if (!loaded) {
          toast.error('Session not found');
          navigate('/');
          return;
        }
        
        setSession(loaded);
        setCurrentSession(loaded);
        loadAvailableParts();
        
        // Resume if session was active
        if (loaded.status === 'active' && loaded.startTime) {
          const elapsed = Math.floor((Date.now() - new Date(loaded.startTime).getTime()) / 1000);
          setElapsedTime(elapsed);
          setIsRunning(true);
        } else if (loaded.totalDuration > 0) {
          setElapsedTime(loaded.totalDuration);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        if (!cached) {
          toast.error('Failed to load session');
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadSession();
  }, [sessionId, navigate, getSession, setCurrentSession, getCachedSession]);

  const loadAvailableParts = async () => {
    try {
      const parts = await fetchSessionParts();
      setAvailableParts(parts);
    } catch (err) {
      console.error('Failed to load session parts:', err);
    }
  };

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!session || !isRunning) return;
    
    const saveInterval = setInterval(() => {
      handleSaveSession();
    }, 5000);
    
    return () => clearInterval(saveInterval);
  }, [session, isRunning, elapsedTime]);

  const handleSaveSession = useCallback(async () => {
    if (!session) return;
    
    const updated = {
      ...session,
      totalDuration: elapsedTime,
      updatedAt: new Date().toISOString()
    };
    
    // Update local state and cache
    setSession(updated);
    setCurrentSession(updated);
    
    // Save to cloud (which also saves to localStorage)
    try {
      await cloudSaveSession(updated);
    } catch (err) {
      console.error('Cloud sync failed:', err);
    }
  }, [session, elapsedTime, cloudSaveSession, setCurrentSession]);

  const handleStart = () => {
    if (!isRunning) {
      const now = new Date().toISOString();
      setSession(prev => ({
        ...prev,
        status: 'active',
        startTime: prev.startTime || now,
        sessionParts: (prev.sessionParts || []).map(p => 
          p.id === prev.activePartId ? { ...p, startTime: now, used: true } : p
        )
      }));
      setIsRunning(true);
      lastBallStateChange.current = Date.now();
      partStartTime.current = Date.now();
      toast.success('Observation started');
    }
  };

  // Show confirmation dialog before ending
  const handleStopClick = () => {
    if (isRunning) {
      setShowEndConfirm(true);
    }
  };

  // Actually end the session after confirmation
  const handleConfirmEnd = async () => {
    setIsSaving(true);
    
    try {
      // Calculate final ball rolling time for current state
      let finalSession;
      
      // Keep all session parts (don't filter by 'used' - this was causing data loss)
      const allParts = (session.sessionParts || []).map(p => {
        if (p.id === session.activePartId && lastBallStateChange.current) {
          const duration = (Date.now() - lastBallStateChange.current) / 1000;
          const ballTimeKey = session.ballRolling ? 'ballRollingTime' : 'ballNotRollingTime';
          return { ...p, [ballTimeKey]: (p[ballTimeKey] || 0) + duration, endTime: new Date().toISOString() };
        }
        return p;
      });
      
      const endTime = new Date().toISOString();
      
      if (lastBallStateChange.current) {
        const duration = (Date.now() - lastBallStateChange.current) / 1000;
        const ballTimeKey = session.ballRolling ? 'ballRollingTime' : 'ballNotRollingTime';
        
        finalSession = {
          ...session,
          [ballTimeKey]: (session[ballTimeKey] || 0) + duration,
          sessionParts: allParts,
          status: 'completed',
          endTime: endTime,
          totalDuration: elapsedTime,
          updatedAt: endTime
        };
      } else {
        finalSession = {
          ...session,
          sessionParts: allParts,
          status: 'completed',
          endTime: endTime,
          totalDuration: elapsedTime,
          updatedAt: endTime
        };
      }
      
      console.log('[LiveObservation] Saving completed session:', {
        id: finalSession.id,
        status: finalSession.status,
        events: finalSession.events?.length,
        duration: finalSession.totalDuration
      });
      
      // Update state and cache
      setSession(finalSession);
      setCurrentSession(finalSession);
      
      // Wait for cloud save to complete
      const saveResult = await cloudSaveSession(finalSession);
      
      console.log('[LiveObservation] Save result:', saveResult);
      
      setIsRunning(false);
      setShowEndConfirm(false);
      
      if (saveResult.success) {
        toast.success('Session completed and saved!');
        navigate(`/session/${sessionId}/review`);
      } else if (saveResult.queued) {
        toast.success('Session completed! Will sync when online.');
        navigate(`/session/${sessionId}/review`);
      } else {
        // Save failed - ask user what to do
        toast.error('Failed to save to cloud. Please try again or check your connection.');
        setIsSaving(false);
        return; // Don't navigate away
      }
    } catch (err) {
      console.error('[LiveObservation] Failed to save session:', err);
      toast.error('Failed to save session. Please try again.');
      setIsSaving(false);
      // Don't close dialog or navigate - let user retry
      return;
    }
  };

  const handleEventTap = (eventType) => {
    if (!isRunning) {
      handleStart();
    }
    
    const event = createEvent(
      eventType.id,
      eventType.name,
      session.activePartId,
      session.ballRolling
    );
    
    setSession(prev => ({
      ...prev,
      events: [...prev.events, event]
    }));
    
    setLastEvent(event);
    setFlashEvent(eventType.id);
    setTimeout(() => setFlashEvent(null), 200);
    
    toast.success(`${eventType.name} logged`, { duration: 1500 });
  };

  const handleDescriptorToggle = (groupNum, descriptorId) => {
    if (!lastEvent) return;
    
    const key = groupNum === 1 ? 'descriptors1' : 'descriptors2';
    
    setSession(prev => ({
      ...prev,
      events: prev.events.map(e => {
        if (e.id === lastEvent.id) {
          const current = e[key];
          const updated = current.includes(descriptorId)
            ? current.filter(d => d !== descriptorId)
            : [...current, descriptorId];
          return { ...e, [key]: updated };
        }
        return e;
      })
    }));
    
    // Update lastEvent state
    setLastEvent(prev => {
      const current = prev[key];
      const updated = current.includes(descriptorId)
        ? current.filter(d => d !== descriptorId)
        : [...current, descriptorId];
      return { ...prev, [key]: updated };
    });
  };

  const handleUndo = () => {
    if (session.events.length === 0) return;
    
    const removed = session.events[session.events.length - 1];
    setSession(prev => ({
      ...prev,
      events: prev.events.slice(0, -1)
    }));
    
    setLastEvent(session.events.length > 1 ? session.events[session.events.length - 2] : null);
    toast.info(`Undid: ${removed.eventTypeName}`);
  };

  const handleBallToggle = () => {
    const now = Date.now();
    
    if (lastBallStateChange.current && isRunning) {
      const duration = (now - lastBallStateChange.current) / 1000;
      const ballTimeKey = session.ballRolling ? 'ballRollingTime' : 'ballNotRollingTime';
      
      setSession(prev => ({
        ...prev,
        [ballTimeKey]: prev[ballTimeKey] + duration,
        sessionParts: prev.sessionParts.map(p => 
          p.id === prev.activePartId 
            ? { ...p, [ballTimeKey]: p[ballTimeKey] + duration }
            : p
        ),
        ballRolling: !prev.ballRolling,
        ballRollingLog: [...prev.ballRollingLog, {
          timestamp: new Date().toISOString(),
          state: !prev.ballRolling,
          partId: prev.activePartId
        }]
      }));
    } else {
      setSession(prev => ({
        ...prev,
        ballRolling: !prev.ballRolling
      }));
    }
    
    lastBallStateChange.current = now;
  };

  const handlePartChange = (partId) => {
    if (partId === session.activePartId) return; // Already on this part
    
    const now = Date.now();
    const nowIso = new Date().toISOString();
    
    if (isRunning && lastBallStateChange.current) {
      // Calculate time spent in current ball state for current part
      const duration = (now - lastBallStateChange.current) / 1000;
      const ballTimeKey = session.ballRolling ? 'ballRollingTime' : 'ballNotRollingTime';
      
      setSession(prev => ({
        ...prev,
        // Update overall session ball time
        [ballTimeKey]: (prev[ballTimeKey] || 0) + duration,
        // Update parts - end current, start new, mark as used
        sessionParts: (prev.sessionParts || []).map(p => {
          if (p.id === prev.activePartId) {
            return { ...p, [ballTimeKey]: (p[ballTimeKey] || 0) + duration, endTime: nowIso };
          }
          if (p.id === partId) {
            return { ...p, startTime: p.startTime || nowIso, used: true };
          }
          return p;
        }),
        activePartId: partId
      }));
      
      // Reset the ball state timer for the new part
      lastBallStateChange.current = now;
    } else {
      setSession(prev => ({
        ...prev,
        sessionParts: (prev.sessionParts || []).map(p => 
          p.id === partId ? { ...p, startTime: p.startTime || nowIso, used: true } : p
        ),
        activePartId: partId
      }));
      lastBallStateChange.current = now;
    }
    
    partStartTime.current = now;
  };

  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    
    const newPart = {
      id: generateId('part'),
      name: newPartName.trim(),
      order: (session.sessionParts || []).length,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0,
      isCustom: true
    };
    
    setSession(prev => ({
      ...prev,
      sessionParts: [...(prev.sessionParts || []), newPart]
    }));
    
    setNewPartName('');
    setShowAddPart(false);
    toast.success(`Added "${newPart.name}"`);
  };

  // Open add part dialog
  const openAddPartDialog = () => {
    setSelectedDefaultPart('custom');
    setCustomPartName('');
    setAddAsDefault(false);
    setShowAddPartDialog(true);
  };

  // Handle adding part from dialog
  const handleAddPartFromDialog = async () => {
    let partName = '';
    
    if (selectedDefaultPart === 'custom') {
      if (!customPartName.trim()) {
        toast.error('Please enter a part name');
        return;
      }
      partName = customPartName.trim();
    } else {
      const defaultPart = availableParts.find(p => p.part_id === selectedDefaultPart);
      if (defaultPart) {
        partName = defaultPart.name;
      }
    }

    if (!partName) {
      toast.error('Please select or enter a part name');
      return;
    }

    setSavingPart(true);
    try {
      // If adding custom as new default (Coach Developer only)
      if (selectedDefaultPart === 'custom' && addAsDefault && isCoachDeveloper()) {
        await createSessionPart(partName, true);
        await loadAvailableParts();
      }

      const newPart = {
        id: generateId('part'),
        name: partName,
        order: (session.sessionParts || []).length,
        startTime: null,
        endTime: null,
        ballRollingTime: 0,
        ballNotRollingTime: 0,
        isDefault: selectedDefaultPart !== 'custom',
        isCustom: selectedDefaultPart === 'custom'
      };
      
      setSession(prev => ({
        ...prev,
        sessionParts: [...(prev.sessionParts || []), newPart]
      }));
      
      setShowAddPartDialog(false);
      toast.success(`Added "${partName}"`);
    } catch (err) {
      toast.error(err.message || 'Failed to add part');
    } finally {
      setSavingPart(false);
    }
  };

  const handleAddNote = () => {
    if (!lastEvent || !noteText.trim()) return;
    
    setSession(prev => ({
      ...prev,
      events: prev.events.map(e => 
        e.id === lastEvent.id ? { ...e, note: noteText } : e
      )
    }));
    
    setLastEvent(prev => ({ ...prev, note: noteText }));
    setNoteText('');
    setShowNoteInput(false);
    toast.success('Note added');
  };

  if (!session) return null;

  const activePart = session.sessionParts.find(p => p.id === session.activePartId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col safe-area-inset">
      {/* Status Bar - Always Visible */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 safe-area-top">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                handleSaveSession();
                navigate('/');
              }}
              className="shrink-0"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 font-['Manrope'] text-sm sm:text-base truncate">{session.name}</h1>
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-wrap">
                <Badge variant="outline" className="font-medium text-xs">
                  {activePart?.name || 'No Part'}
                </Badge>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  session.ballRolling ? "text-orange-600" : "text-slate-500"
                )}>
                  {session.ballRolling ? (
                    <>
                      <Circle className="w-3 h-3 fill-current ball-rolling-indicator" />
                      <span className="hidden sm:inline">Ball Rolling</span>
                      <span className="sm:hidden">Rolling</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3 h-3" />
                      <span className="hidden sm:inline">Ball Stopped</span>
                      <span className="sm:hidden">Stopped</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          
          {/* Timer */}
          <div className="text-center shrink-0">
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono timer-display text-slate-900" data-testid="session-timer">
              {formatTime(elapsedTime)}
            </div>
            <SyncStatusIndicator className="justify-center" />
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {session.events.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUndo}
                className="undo-btn hidden sm:flex"
                data-testid="undo-btn"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Undo
              </Button>
            )}
            {session.events.length > 0 && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleUndo}
                className="undo-btn sm:hidden"
                data-testid="undo-btn-mobile"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            )}
            {!isRunning ? (
              <Button 
                onClick={handleStart}
                className="bg-green-600 hover:bg-green-700 text-sm sm:text-base px-3 sm:px-4"
                data-testid="start-btn"
              >
                Start
              </Button>
            ) : (
              <Button 
                onClick={handleStopClick}
                variant="destructive"
                className="text-sm sm:text-base px-2 sm:px-4"
                data-testid="stop-btn"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                <span className="hidden sm:inline">End Session</span>
                <span className="sm:hidden">End</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Session Parts Tabs */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto py-2 items-center tabs-responsive">
          {(session.sessionParts || []).map((part) => (
            <button
              key={part.id}
              onClick={() => handlePartChange(part.id)}
              className={cn(
                "px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                "min-h-[44px] touch-action-manipulation",
                part.id === session.activePartId
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              data-testid={`part-btn-${part.id}`}
            >
              {part.name}
            </button>
          ))}
          <button
            onClick={openAddPartDialog}
            className="px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all whitespace-nowrap flex items-center gap-1 min-h-[44px]"
            data-testid="add-part-btn"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Part</span>
          </button>
        </div>
      </div>

      {/* Add Part Dialog */}
      <Dialog open={showAddPartDialog} onOpenChange={setShowAddPartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session Part</DialogTitle>
            <DialogDescription>
              Select from default parts or create a custom one.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Select a Part</Label>
              <Select value={selectedDefaultPart} onValueChange={setSelectedDefaultPart}>
                <SelectTrigger className="mt-1" data-testid="select-default-part">
                  <SelectValue placeholder="Choose a part..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Part</SelectItem>
                  {availableParts.filter(p => p.is_default).map(part => {
                    const isAlreadyAdded = (session.sessionParts || []).some(sp => sp.name === part.name);
                    return (
                      <SelectItem 
                        key={part.part_id} 
                        value={part.part_id}
                        disabled={isAlreadyAdded}
                      >
                        {part.name} {isAlreadyAdded && "(already added)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            {selectedDefaultPart === 'custom' && (
              <>
                <div>
                  <Label htmlFor="custom-part-name">Custom Part Name</Label>
                  <Input
                    id="custom-part-name"
                    value={customPartName}
                    onChange={(e) => setCustomPartName(e.target.value)}
                    placeholder="e.g., Cool Down"
                    className="mt-1"
                    data-testid="custom-part-input"
                  />
                </div>
                
                {isCoachDeveloper() && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add-as-default"
                      checked={addAsDefault}
                      onChange={(e) => setAddAsDefault(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="add-as-default" className="text-sm text-slate-600 cursor-pointer">
                      Add as new default (available globally)
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPartDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddPartFromDialog} 
              disabled={savingPart || (selectedDefaultPart === 'custom' && !customPartName.trim())}
            >
              {savingPart ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ball Rolling Toggle */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
        <button
          onClick={handleBallToggle}
          className={cn(
            "w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all min-h-[56px] sm:min-h-[64px]",
            session.ballRolling
              ? "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700"
              : "bg-slate-600 text-white hover:bg-slate-700 active:bg-slate-800"
          )}
          data-testid="ball-toggle-btn"
        >
          {session.ballRolling ? (
            <span className="flex items-center justify-center gap-2">
              <Circle className="w-4 sm:w-5 h-4 sm:h-5 fill-current ball-rolling-indicator" />
              Ball Rolling
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Square className="w-4 sm:w-5 h-4 sm:h-5" />
              Ball Not Rolling
            </span>
          )}
        </button>
      </div>

      {/* Code Window Grid */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 max-w-6xl mx-auto">
          {/* Column 1: Coach Interventions (Yellow) */}
          <div className="space-y-2 sm:space-y-3 col-span-2 sm:col-span-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              Coach Interventions
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3">
              {(session.interventionTypes || session.eventTypes || []).map((eventType) => (
                <button
                  key={eventType.id}
                  onClick={() => handleEventTap(eventType)}
                  className={cn(
                    "w-full h-16 sm:h-20 lg:h-24 rounded-xl font-bold text-sm sm:text-base lg:text-lg shadow-md transition-all",
                    "bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-slate-900",
                    "border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1",
                    flashEvent === eventType.id && "event-logged"
                  )}
                  data-testid={`event-btn-${eventType.id}`}
                >
                  {eventType.name}
                </button>
              ))}
            </div>
          </div>

          {/* Column 2: Descriptor Group 1 (Blue) */}
          <div className="space-y-2 sm:space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {session.descriptorGroup1.name}
            </div>
            {session.descriptorGroup1.descriptors.map((desc) => {
              const isSelected = lastEvent?.descriptors1?.includes(desc.id);
              return (
                <button
                  key={desc.id}
                  onClick={() => handleDescriptorToggle(1, desc.id)}
                  disabled={!lastEvent}
                  className={cn(
                    "w-full h-14 sm:h-16 lg:h-20 rounded-xl font-semibold text-sm sm:text-base transition-all",
                    "border-2",
                    !lastEvent && "opacity-40 cursor-not-allowed",
                    isSelected
                      ? "bg-sky-500 text-white border-sky-700 shadow-lg"
                      : "bg-sky-400 text-white border-transparent hover:bg-sky-500 active:bg-sky-600"
                  )}
                  data-testid={`desc1-btn-${desc.id}`}
                >
                  <span className="flex items-center justify-center gap-1 sm:gap-2">
                    {isSelected && <Check className="w-3 sm:w-4 h-3 sm:h-4" />}
                    {desc.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Column 3: Descriptor Group 2 (Green) */}
          <div className="space-y-2 sm:space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {session.descriptorGroup2.name}
            </div>
            {session.descriptorGroup2.descriptors.map((desc) => {
              const isSelected = lastEvent?.descriptors2?.includes(desc.id);
              return (
                <button
                  key={desc.id}
                  onClick={() => handleDescriptorToggle(2, desc.id)}
                  disabled={!lastEvent}
                  className={cn(
                    "w-full h-14 sm:h-16 lg:h-20 rounded-xl font-semibold text-sm sm:text-base transition-all",
                    "border-2",
                    !lastEvent && "opacity-40 cursor-not-allowed",
                    isSelected
                      ? "bg-green-500 text-white border-green-700 shadow-lg"
                      : "bg-green-400 text-white border-transparent hover:bg-green-500 active:bg-green-600"
                  )}
                  data-testid={`desc2-btn-${desc.id}`}
                >
                  <span className="flex items-center justify-center gap-1 sm:gap-2">
                    {isSelected && <Check className="w-3 sm:w-4 h-3 sm:h-4" />}
                    {desc.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Last Event Panel (fixed at bottom) */}
      {lastEvent && (
        <div className="bg-white border-t border-slate-200 px-4 py-3">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded bg-yellow-400" />
                <span className="font-medium text-slate-900">{lastEvent.eventTypeName}</span>
                <span className="text-sm text-slate-500">
                  {new Date(lastEvent.timestamp).toLocaleTimeString()}
                </span>
                {lastEvent.descriptors1.length > 0 && (
                  <div className="flex gap-1">
                    {lastEvent.descriptors1.map(d => {
                      const desc = session.descriptorGroup1.descriptors.find(x => x.id === d);
                      return desc && (
                        <Badge key={d} className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                          {desc.name}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {lastEvent.descriptors2.length > 0 && (
                  <div className="flex gap-1">
                    {lastEvent.descriptors2.map(d => {
                      const desc = session.descriptorGroup2.descriptors.find(x => x.id === d);
                      return desc && (
                        <Badge key={d} className="bg-green-100 text-green-800 hover:bg-green-100">
                          {desc.name}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {lastEvent.note && (
                  <span className="text-sm text-slate-600 italic">"{lastEvent.note}"</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {showNoteInput ? (
                  <div className="flex items-center gap-2">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      className="w-48 h-10 text-sm resize-none"
                      data-testid="note-input"
                    />
                    <Button size="icon" variant="ghost" onClick={handleAddNote}>
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setShowNoteInput(false)}>
                      <X className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNoteInput(true)}
                    data-testid="add-note-btn"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Note
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intervention Count Badge */}
      <div className="fixed bottom-4 right-4">
        <Badge className="bg-slate-900 text-white text-lg px-3 py-1" data-testid="event-count-badge">
          {session.events.length} interventions
        </Badge>
      </div>

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Observation Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end this observation? 
              You have recorded <strong>{session.events.length} interventions</strong> over <strong>{formatTime(elapsedTime)}</strong>.
              <br /><br />
              The session will be marked as completed and saved to the cloud.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Continue Observing</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmEnd} 
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'End & Save Session'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
