import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Undo2, Square, Circle, MessageSquare, Check, X, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { storage, createEvent } from '../lib/storage';
import { formatTime, cn, generateId } from '../lib/utils';

export default function LiveObservation() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  
  const [session, setSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [flashEvent, setFlashEvent] = useState(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  
  const timerRef = useRef(null);
  const lastBallStateChange = useRef(null);
  const partStartTime = useRef(null);

  // Load session
  useEffect(() => {
    const loaded = storage.getSession(sessionId);
    if (!loaded) {
      toast.error('Session not found');
      navigate('/');
      return;
    }
    
    setSession(loaded);
    
    // Resume if session was active
    if (loaded.status === 'active' && loaded.startTime) {
      const elapsed = Math.floor((Date.now() - new Date(loaded.startTime).getTime()) / 1000);
      setElapsedTime(elapsed);
      setIsRunning(true);
    } else if (loaded.totalDuration > 0) {
      setElapsedTime(loaded.totalDuration);
    }
  }, [sessionId, navigate]);

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
      saveSession();
    }, 5000);
    
    return () => clearInterval(saveInterval);
  }, [session, isRunning, elapsedTime]);

  const saveSession = useCallback(() => {
    if (!session) return;
    
    const updated = {
      ...session,
      totalDuration: elapsedTime,
      updatedAt: new Date().toISOString()
    };
    storage.saveSession(updated);
  }, [session, elapsedTime]);

  const handleStart = () => {
    if (!isRunning) {
      const now = new Date().toISOString();
      setSession(prev => ({
        ...prev,
        status: 'active',
        startTime: prev.startTime || now,
        sessionParts: prev.sessionParts.map((p, i) => 
          p.id === prev.activePartId ? { ...p, startTime: now, used: true } : p
        )
      }));
      setIsRunning(true);
      lastBallStateChange.current = Date.now();
      partStartTime.current = Date.now();
      toast.success('Observation started');
    }
  };

  const handleStop = () => {
    if (isRunning) {
      // Calculate final ball rolling time for current state
      if (lastBallStateChange.current) {
        const duration = (Date.now() - lastBallStateChange.current) / 1000;
        const ballTimeKey = session.ballRolling ? 'ballRollingTime' : 'ballNotRollingTime';
        
        setSession(prev => {
          // Filter out unused parts and update times
          const usedParts = prev.sessionParts
            .filter(p => p.used)
            .map(p => 
              p.id === prev.activePartId 
                ? { ...p, [ballTimeKey]: p[ballTimeKey] + duration, endTime: new Date().toISOString() }
                : p
            );
          
          return {
            ...prev,
            [ballTimeKey]: prev[ballTimeKey] + duration,
            sessionParts: usedParts,
            status: 'completed',
            endTime: new Date().toISOString(),
            totalDuration: elapsedTime
          };
        });
      } else {
        // No ball state changes - just filter unused parts
        setSession(prev => ({
          ...prev,
          sessionParts: prev.sessionParts.filter(p => p.used),
          status: 'completed',
          endTime: new Date().toISOString(),
          totalDuration: elapsedTime
        }));
      }
      
      setIsRunning(false);
      
      setTimeout(() => {
        saveSession();
        toast.success('Session completed');
        navigate(`/session/${sessionId}/review`);
      }, 100);
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
        [ballTimeKey]: prev[ballTimeKey] + duration,
        // Update parts - end current, start new
        sessionParts: prev.sessionParts.map(p => {
          if (p.id === prev.activePartId) {
            return { ...p, [ballTimeKey]: p[ballTimeKey] + duration, endTime: nowIso };
          }
          if (p.id === partId) {
            return { ...p, startTime: p.startTime || nowIso };
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
        sessionParts: prev.sessionParts.map(p => 
          p.id === partId ? { ...p, startTime: p.startTime || nowIso } : p
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
      order: session.sessionParts.length,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0
    };
    
    setSession(prev => ({
      ...prev,
      sessionParts: [...prev.sessionParts, newPart]
    }));
    
    setNewPartName('');
    setShowAddPart(false);
    toast.success(`Added "${newPart.name}"`);
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Status Bar - Always Visible */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                saveSession();
                navigate('/');
              }}
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-slate-900 font-['Manrope']">{session.name}</h1>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="font-medium">
                  {activePart?.name || 'No Part'}
                </Badge>
                <span className="text-slate-400">•</span>
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  session.ballRolling ? "text-orange-600" : "text-slate-500"
                )}>
                  {session.ballRolling ? (
                    <>
                      <Circle className="w-3 h-3 fill-current ball-rolling-indicator" />
                      Ball Rolling
                    </>
                  ) : (
                    <>
                      <Square className="w-3 h-3" />
                      Ball Stopped
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          
          {/* Timer */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono timer-display text-slate-900" data-testid="session-timer">
              {formatTime(elapsedTime)}
            </div>
            <div className="text-xs text-slate-500">Session Time</div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {session.events.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUndo}
                className="undo-btn"
                data-testid="undo-btn"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Undo
              </Button>
            )}
            {!isRunning ? (
              <Button 
                onClick={handleStart}
                className="bg-green-600 hover:bg-green-700"
                data-testid="start-btn"
              >
                Start
              </Button>
            ) : (
              <Button 
                onClick={handleStop}
                variant="destructive"
                data-testid="stop-btn"
              >
                End Session
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Session Parts Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="flex gap-1 overflow-x-auto py-2 items-center">
          {session.sessionParts.map((part) => (
            <button
              key={part.id}
              onClick={() => handlePartChange(part.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap touch-button",
                part.id === session.activePartId
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              data-testid={`part-btn-${part.id}`}
            >
              {part.name}
            </button>
          ))}
          {showAddPart ? (
            <div className="flex items-center gap-1 ml-1">
              <Input
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="Part name"
                className="w-28 h-9 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddPart()}
                data-testid="new-part-input"
              />
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleAddPart}>
                <Check className="w-4 h-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setShowAddPart(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPart(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all whitespace-nowrap flex items-center gap-1"
              data-testid="add-part-btn"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          )}
        </div>
      </div>

      {/* Ball Rolling Toggle */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <button
          onClick={handleBallToggle}
          className={cn(
            "w-full py-4 rounded-xl font-bold text-lg transition-all touch-button",
            session.ballRolling
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-slate-600 text-white hover:bg-slate-700"
          )}
          data-testid="ball-toggle-btn"
        >
          {session.ballRolling ? (
            <span className="flex items-center justify-center gap-2">
              <Circle className="w-5 h-5 fill-current ball-rolling-indicator" />
              Ball Rolling
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Square className="w-5 h-5" />
              Ball Not Rolling
            </span>
          )}
        </button>
      </div>

      {/* Code Window Grid */}
      <main className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-3 gap-3 max-w-5xl mx-auto">
          {/* Column 1: Events (Yellow) */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              Events
            </div>
            {session.eventTypes.map((eventType) => (
              <button
                key={eventType.id}
                onClick={() => handleEventTap(eventType)}
                className={cn(
                  "w-full h-24 rounded-xl font-bold text-lg shadow-md transition-all touch-button",
                  "bg-yellow-400 hover:bg-yellow-500 text-slate-900",
                  "border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1",
                  flashEvent === eventType.id && "event-logged"
                )}
                data-testid={`event-btn-${eventType.id}`}
              >
                {eventType.name}
              </button>
            ))}
          </div>

          {/* Column 2: Descriptor Group 1 (Blue) */}
          <div className="space-y-3">
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
                    "w-full h-20 rounded-xl font-semibold transition-all touch-button",
                    "border-2",
                    !lastEvent && "opacity-40 cursor-not-allowed",
                    isSelected
                      ? "bg-sky-500 text-white border-sky-700 shadow-lg"
                      : "bg-sky-400 text-white border-transparent hover:bg-sky-500"
                  )}
                  data-testid={`desc1-btn-${desc.id}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSelected && <Check className="w-4 h-4" />}
                    {desc.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Column 3: Descriptor Group 2 (Green) */}
          <div className="space-y-3">
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
                    "w-full h-20 rounded-xl font-semibold transition-all touch-button",
                    "border-2",
                    !lastEvent && "opacity-40 cursor-not-allowed",
                    isSelected
                      ? "bg-green-500 text-white border-green-700 shadow-lg"
                      : "bg-green-400 text-white border-transparent hover:bg-green-500"
                  )}
                  data-testid={`desc2-btn-${desc.id}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSelected && <Check className="w-4 h-4" />}
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

      {/* Event Count Badge */}
      <div className="fixed bottom-4 right-4">
        <Badge className="bg-slate-900 text-white text-lg px-3 py-1" data-testid="event-count-badge">
          {session.events.length} events
        </Badge>
      </div>
    </div>
  );
}
