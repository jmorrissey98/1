import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Trash2, Edit2, Save, X, Clock, Plus, GripVertical, AlertTriangle, Move } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatTime, generateId } from '../lib/utils';

// Format time for display (milliseconds to MM:SS)
const formatRelativeTime = (ms) => {
  if (ms === undefined || ms === null) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Parse MM:SS or HH:MM:SS to milliseconds
const parseTimeToMs = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
};

// Session part colors for visual distinction
const PART_COLORS = [
  'bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-teal-400', 
  'bg-pink-400', 'bg-indigo-400', 'bg-orange-400', 'bg-cyan-400'
];

/**
 * Session Edit Timeline Component
 * Allows editing of completed sessions including:
 * - Session start/end times
 * - Interventions (remove, change type, edit descriptors)
 * - Session parts/segments with visual timeline
 * - Ball rolling timeline (draggable)
 */
export function SessionEditTimeline({
  session,
  onSave,
  onCancel,
  interventionTypes = [],
  descriptorGroup1 = null,
  descriptorGroup2 = null,
  sessionParts = []
}) {
  const [editedSession, setEditedSession] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showAddPartDialog, setShowAddPartDialog] = useState(false);
  const [newPartName, setNewPartName] = useState('');

  // Initialize editable session from props
  useEffect(() => {
    if (session) {
      setEditedSession({
        ...session,
        events: [...(session.events || [])],
        ballRollingLog: [...(session.ballRollingLog || [])],
        sessionParts: [...(session.sessionParts || [])]
      });
    }
  }, [session]);

  if (!editedSession) return null;

  const totalDuration = editedSession.totalDuration || 0;
  const totalDurationMs = totalDuration * 1000;
  const sessionStartTime = editedSession.startTime ? new Date(editedSession.startTime) : null;
  const sessionEndTime = editedSession.endTime ? new Date(editedSession.endTime) : null;

  // Update session times
  const handleTimeChange = (field, value) => {
    const newTime = new Date(value);
    
    setEditedSession(prev => {
      const updated = { ...prev, [field]: newTime.toISOString() };
      
      if (updated.startTime && updated.endTime) {
        const start = new Date(updated.startTime);
        const end = new Date(updated.endTime);
        const duration = (end - start) / 1000;
        
        if (duration < 0) {
          setShowTimeWarning(true);
          return prev;
        }
        
        updated.totalDuration = duration;
      }
      
      setShowTimeWarning(false);
      return updated;
    });
    setIsDirty(true);
  };

  // Update event
  const handleEventUpdate = (eventId, updates) => {
    setEditedSession(prev => ({
      ...prev,
      events: (prev.events || []).map(e =>
        e.id === eventId ? { ...e, ...updates } : e
      )
    }));
    setIsDirty(true);
    setEditingEvent(null);
  };

  // Delete event
  const handleEventDelete = (eventId) => {
    setEditedSession(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== eventId)
    }));
    setIsDirty(true);
    toast.success('Intervention removed');
  };

  // Update event timestamp
  const handleEventTimestampChange = (eventId, newRelativeMs) => {
    const sessionDurationMs = totalDurationMs;
    const clampedMs = Math.max(0, Math.min(newRelativeMs, sessionDurationMs));
    
    setEditedSession(prev => {
      const sessionStart = new Date(prev.startTime).getTime();
      const updatedEvents = (prev.events || []).map(e => {
        if (e.id === eventId) {
          const newTimestamp = new Date(sessionStart + clampedMs).toISOString();
          return { ...e, relativeTimestamp: clampedMs, timestamp: newTimestamp };
        }
        return e;
      });
      
      updatedEvents.sort((a, b) => (a.relativeTimestamp || 0) - (b.relativeTimestamp || 0));
      return { ...prev, events: updatedEvents };
    });
    setIsDirty(true);
  };

  // Session Parts handlers
  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    
    const newPart = {
      id: generateId(),
      name: newPartName.trim(),
      startTime: 0,
      endTime: totalDurationMs,
      used: false,
      ballRollingTime: 0,
      ballNotRollingTime: 0
    };
    
    setEditedSession(prev => ({
      ...prev,
      sessionParts: [...(prev.sessionParts || []), newPart]
    }));
    
    setNewPartName('');
    setShowAddPartDialog(false);
    setIsDirty(true);
    toast.success('Session part added');
  };

  const handleUpdatePart = (partId, updates) => {
    setEditedSession(prev => ({
      ...prev,
      sessionParts: (prev.sessionParts || []).map(p =>
        p.id === partId ? { ...p, ...updates } : p
      )
    }));
    setIsDirty(true);
  };

  const handleDeletePart = (partId) => {
    setEditedSession(prev => ({
      ...prev,
      sessionParts: (prev.sessionParts || []).filter(p => p.id !== partId)
    }));
    setIsDirty(true);
    toast.success('Session part removed');
  };

  const handleReorderParts = (fromIndex, toIndex) => {
    setEditedSession(prev => {
      const parts = [...(prev.sessionParts || [])];
      const [moved] = parts.splice(fromIndex, 1);
      parts.splice(toIndex, 0, moved);
      return { ...prev, sessionParts: parts };
    });
    setIsDirty(true);
  };

  // Ball rolling update handler
  const handleBallRollingUpdate = (updates) => {
    setEditedSession(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  // Recalculate derived values before save
  const recalculateDerivedValues = (sessionData) => {
    if (sessionData.startTime && sessionData.endTime) {
      const start = new Date(sessionData.startTime).getTime();
      const end = new Date(sessionData.endTime).getTime();
      sessionData.totalDuration = Math.max(0, (end - start) / 1000);
    }
    return sessionData;
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const finalSession = recalculateDerivedValues({ ...editedSession });
      finalSession.lastEditedAt = new Date().toISOString();
      await onSave(finalSession);
      setIsDirty(false);
      toast.success('Session updated successfully');
    } catch (err) {
      console.error('Failed to save session:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Calculate position on timeline (0-100%)
  const getTimelinePosition = (ms) => {
    const durationMs = totalDurationMs || 1;
    return Math.min(100, Math.max(0, (ms / durationMs) * 100));
  };

  return (
    <div className="space-y-6">
      {/* Edit Mode Header */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-lg text-orange-900">Edit Mode</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!isDirty || saving} className="bg-orange-600 hover:bg-orange-700">
                {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-1" />Save Changes</>}
              </Button>
            </div>
          </div>
          <CardDescription className="text-orange-700">
            Make changes to the session timeline. All changes will be saved when you click "Save Changes".
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Time Warning */}
      {showTimeWarning && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>End time cannot be before start time</span>
        </div>
      )}

      {/* Session Times */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Session Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={sessionStartTime ? sessionStartTime.toISOString().slice(0, 16) : ''}
                onChange={(e) => handleTimeChange('startTime', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                value={sessionEndTime ? sessionEndTime.toISOString().slice(0, 16) : ''}
                onChange={(e) => handleTimeChange('endTime', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Duration</Label>
              <div className="flex items-center h-10 px-3 border rounded-md bg-slate-50">
                <span className="text-slate-700 font-mono">{formatTime(totalDuration)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ball Rolling Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ball Rolling Timeline</CardTitle>
          <CardDescription>
            Drag the dividers to adjust ball rolling/not rolling periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BallRollingTimelineEditor
            session={editedSession}
            onChange={handleBallRollingUpdate}
          />
        </CardContent>
      </Card>

      {/* Session Parts Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Session Parts</CardTitle>
              <CardDescription>
                Visual timeline of session segments. Drag to reorder, click to edit.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddPartDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Part
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SessionPartsTimelineEditor
            parts={editedSession.sessionParts || []}
            totalDurationMs={totalDurationMs}
            sessionStartTime={editedSession.startTime}
            onUpdatePart={handleUpdatePart}
            onDeletePart={handleDeletePart}
            onReorderParts={handleReorderParts}
          />
        </CardContent>
      </Card>

      {/* Interventions Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interventions ({(editedSession.events || []).length})</CardTitle>
          <CardDescription>
            Edit or remove interventions. Click on an intervention to modify it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Visual Timeline */}
          <div className="relative h-12 bg-slate-100 rounded-lg mb-4">
            <div className="absolute inset-0 flex justify-between px-2 items-end pb-1 text-xs text-slate-400">
              <span>0:00</span>
              <span>{formatTime(totalDuration / 2)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
            
            {(editedSession.events || []).map((event) => {
              const position = getTimelinePosition(event.relativeTimestamp || 0);
              return (
                <button
                  key={event.id}
                  className={cn(
                    "absolute top-1 w-3 h-8 rounded-sm cursor-pointer transition-all hover:scale-110",
                    editingEvent?.id === event.id ? "ring-2 ring-orange-500" : "",
                    "bg-yellow-400"
                  )}
                  style={{ left: `calc(${position}% - 6px)` }}
                  onClick={() => setEditingEvent(event)}
                  title={`${event.eventTypeName || 'Event'} at ${formatRelativeTime(event.relativeTimestamp)}`}
                />
              );
            })}
          </div>

          {/* Event List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(editedSession.events || []).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg transition-all",
                  editingEvent?.id === event.id ? "border-orange-400 bg-orange-50" : "hover:bg-slate-50"
                )}
              >
                <div className="w-16 text-center">
                  <Input
                    type="text"
                    value={formatRelativeTime(event.relativeTimestamp)}
                    onChange={(e) => {
                      const ms = parseTimeToMs(e.target.value);
                      handleEventTimestampChange(event.id, ms);
                    }}
                    className="text-center text-xs h-8"
                    placeholder="MM:SS"
                  />
                </div>
                
                <Select
                  value={event.eventTypeId}
                  onValueChange={(value) => {
                    const type = interventionTypes.find(t => t.id === value);
                    handleEventUpdate(event.id, {
                      eventTypeId: value,
                      eventTypeName: type?.name || value
                    });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {interventionTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex-1 flex flex-wrap gap-1">
                  {(event.descriptors1 || []).map(d => {
                    const desc = descriptorGroup1?.descriptors?.find(x => x.id === d);
                    return desc && (
                      <Badge key={d} className="bg-sky-100 text-sky-800 text-xs">{desc.name}</Badge>
                    );
                  })}
                  {(event.descriptors2 || []).map(d => {
                    const desc = descriptorGroup2?.descriptors?.find(x => x.id === d);
                    return desc && (
                      <Badge key={d} className="bg-green-100 text-green-800 text-xs">{desc.name}</Badge>
                    );
                  })}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Intervention?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the "{event.eventTypeName || 'intervention'}" at {formatRelativeTime(event.relativeTimestamp)}.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleEventDelete(event.id)} className="bg-red-600 hover:bg-red-700">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
            
            {(editedSession.events || []).length === 0 && (
              <p className="text-center text-slate-500 py-8">No interventions recorded</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Part Dialog */}
      <Dialog open={showAddPartDialog} onOpenChange={setShowAddPartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session Part</DialogTitle>
            <DialogDescription>
              Add a new segment to the session timeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Part Name</Label>
              <Input
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="e.g., Warm-up, Main Activity, Cool-down"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPartDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPart} disabled={!newPartName.trim()}>Add Part</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      {editingEvent && (
        <EventEditDialog
          event={editingEvent}
          interventionTypes={interventionTypes}
          descriptorGroup1={descriptorGroup1}
          descriptorGroup2={descriptorGroup2}
          sessionParts={editedSession.sessionParts || []}
          onSave={(updates) => handleEventUpdate(editingEvent.id, updates)}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}

/**
 * Ball Rolling Timeline Editor - TIME-BASED VERSION
 * Shows actual timestamped ON/OFF events from the session's ballRollingLog
 * Each segment represents a period when ball was either rolling or not rolling
 */
function BallRollingTimelineEditor({ session, onChange }) {
  const containerRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [dragging, setDragging] = useState(null);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : 0;
  const sessionEndMs = session.endTime ? new Date(session.endTime).getTime() : sessionStartMs + (session.totalDuration || 0) * 1000;
  const totalMs = sessionEndMs - sessionStartMs || 1;

  // Build segments from actual ballRollingLog timestamps
  useEffect(() => {
    const log = session.ballRollingLog || [];
    
    if (log.length === 0) {
      // No log entries - show a simple display based on total times recorded
      const rollingMs = (session.ballRollingTime || 0) * 1000;
      const notRollingMs = (session.ballNotRollingTime || 0) * 1000;
      const actualTotalMs = rollingMs + notRollingMs;
      
      if (actualTotalMs === 0) {
        // No ball time data at all
        setSegments([
          { id: 'seg_empty', type: 'not_rolling', startMs: 0, endMs: totalMs, timestamp: null }
        ]);
      } else if (rollingMs > 0 && notRollingMs > 0) {
        // We have both times but no detailed log - show approximate split
        setSegments([
          { id: 'seg_0', type: 'rolling', startMs: 0, endMs: rollingMs, timestamp: session.startTime },
          { id: 'seg_1', type: 'not_rolling', startMs: rollingMs, endMs: rollingMs + notRollingMs, timestamp: null }
        ]);
      } else if (rollingMs > 0) {
        setSegments([
          { id: 'seg_0', type: 'rolling', startMs: 0, endMs: rollingMs, timestamp: session.startTime }
        ]);
      } else {
        setSegments([
          { id: 'seg_0', type: 'not_rolling', startMs: 0, endMs: notRollingMs, timestamp: null }
        ]);
      }
      return;
    }

    // Sort log by timestamp
    const sortedLog = [...log].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Build segments from log entries
    // Each log entry represents a STATE CHANGE - the timestamp is when the state changed TO the new value
    const newSegments = [];
    
    const firstLogTime = new Date(sortedLog[0].timestamp).getTime();
    const firstState = sortedLog[0].state;
    
    // Before the first log entry, the ball was in the OPPOSITE state
    // (because the log records when the state CHANGED to a new value)
    if (firstLogTime > sessionStartMs) {
      newSegments.push({
        id: 'seg_initial',
        type: firstState ? 'not_rolling' : 'rolling', // Opposite of what it changed TO
        startMs: 0,
        endMs: firstLogTime - sessionStartMs,
        timestamp: session.startTime
      });
    }

    // Add segments for each log entry
    // Each entry marks the START of a period in the recorded state
    for (let i = 0; i < sortedLog.length; i++) {
      const entry = sortedLog[i];
      const entryTime = new Date(entry.timestamp).getTime();
      const startMs = entryTime - sessionStartMs;
      
      // End time is either the next entry or session end
      const nextEntry = sortedLog[i + 1];
      const endMs = nextEntry 
        ? new Date(nextEntry.timestamp).getTime() - sessionStartMs
        : totalMs;
      
      newSegments.push({
        id: `seg_${i}`,
        type: entry.state ? 'rolling' : 'not_rolling',
        startMs: Math.max(0, startMs),
        endMs: Math.min(totalMs, endMs),
        timestamp: entry.timestamp,
        partId: entry.partId
      });
    }

    setSegments(newSegments);
  }, [session.ballRollingLog, session.startTime, session.endTime, totalMs, session.ballRollingTime, session.ballNotRollingTime]);

  const handleDragStart = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ index, startX: e.clientX });
  }, []);

  const handleDrag = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const newEndMs = (percentage / 100) * totalMs;
    
    setSegments(prev => {
      const updated = [...prev];
      const seg = updated[dragging.index];
      if (seg && dragging.index < updated.length - 1) {
        const nextSeg = updated[dragging.index + 1];
        const minEnd = seg.startMs + 1000;
        const maxEnd = nextSeg.endMs - 1000;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, newEndMs));
        
        // Update segment boundaries
        updated[dragging.index] = { ...seg, endMs: clampedEnd };
        updated[dragging.index + 1] = { ...nextSeg, startMs: clampedEnd };
        
        // Update timestamp for the boundary
        const newTimestamp = new Date(sessionStartMs + clampedEnd).toISOString();
        updated[dragging.index + 1] = { ...updated[dragging.index + 1], timestamp: newTimestamp };
      }
      return updated;
    });
  }, [dragging, totalMs, sessionStartMs]);

  const handleDragEnd = useCallback(() => {
    if (!dragging) return;
    
    const currentSegments = segmentsRef.current;
    
    // Recalculate ball rolling times from segments
    let rollingTime = 0;
    let notRollingTime = 0;
    
    currentSegments.forEach(seg => {
      const duration = (seg.endMs - seg.startMs) / 1000;
      if (seg.type === 'rolling') {
        rollingTime += duration;
      } else {
        notRollingTime += duration;
      }
    });
    
    // Rebuild ballRollingLog from segments
    const newLog = [];
    currentSegments.forEach((seg, index) => {
      if (index > 0 || seg.timestamp) {
        newLog.push({
          timestamp: seg.timestamp || new Date(sessionStartMs + seg.startMs).toISOString(),
          state: seg.type === 'rolling',
          partId: seg.partId || null
        });
      }
    });
    
    onChange({
      ballRollingTime: Math.max(0, rollingTime),
      ballNotRollingTime: Math.max(0, notRollingTime),
      ballRollingLog: newLog
    });
    
    setDragging(null);
  }, [dragging, onChange, sessionStartMs]);

  useEffect(() => {
    if (dragging) {
      const handleMouseMove = (e) => handleDrag(e);
      const handleMouseUp = () => handleDragEnd();
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleDrag, handleDragEnd]);

  // Touch support
  const handleTouchStart = useCallback((index, e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setDragging({ index, startX: touch.clientX });
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const newEndMs = (percentage / 100) * totalMs;
    
    setSegments(prev => {
      const updated = [...prev];
      const seg = updated[dragging.index];
      if (seg && dragging.index < updated.length - 1) {
        const nextSeg = updated[dragging.index + 1];
        const minEnd = seg.startMs + 1000;
        const maxEnd = nextSeg.endMs - 1000;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, newEndMs));
        
        updated[dragging.index] = { ...seg, endMs: clampedEnd };
        updated[dragging.index + 1] = { ...nextSeg, startMs: clampedEnd };
      }
      return updated;
    });
  }, [dragging, totalMs]);

  useEffect(() => {
    if (dragging) {
      const container = containerRef.current;
      if (container) {
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleDragEnd);
        
        return () => {
          container.removeEventListener('touchmove', handleTouchMove);
          container.removeEventListener('touchend', handleDragEnd);
        };
      }
    }
  }, [dragging, handleTouchMove, handleDragEnd]);

  // Format timestamp for display
  const formatTimestamp = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Timeline with time markers */}
      <div className="relative">
        {/* Time markers above */}
        <div className="flex justify-between text-xs text-slate-400 mb-1 px-1">
          <span>0:00</span>
          <span>{formatTimestamp(totalMs / 4)}</span>
          <span>{formatTimestamp(totalMs / 2)}</span>
          <span>{formatTimestamp(totalMs * 3 / 4)}</span>
          <span>{formatTimestamp(totalMs)}</span>
        </div>
        
        {/* Main timeline */}
        <div 
          ref={containerRef}
          className="relative h-14 bg-slate-200 rounded-lg overflow-hidden select-none"
        >
          {segments.map((seg, index) => {
            const leftPercent = (seg.startMs / totalMs) * 100;
            const widthPercent = ((seg.endMs - seg.startMs) / totalMs) * 100;
            
            return (
              <div
                key={seg.id}
                className={cn(
                  "absolute top-0 bottom-0 flex flex-col items-center justify-center text-white text-xs font-medium",
                  seg.type === 'rolling' ? "bg-green-500" : "bg-red-400"
                )}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`
                }}
              >
                {/* Show time at start of segment */}
                {widthPercent > 8 && (
                  <span className="text-[10px] opacity-80">{formatTimestamp(seg.startMs)}</span>
                )}
                {widthPercent > 12 && (
                  <span className="font-bold">{seg.type === 'rolling' ? 'ON' : 'OFF'}</span>
                )}
                {widthPercent > 15 && (
                  <span className="text-[10px]">{formatTimestamp(seg.endMs - seg.startMs)}</span>
                )}
                
                {/* Drag handle at segment boundary */}
                {index < segments.length - 1 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 bg-slate-700 cursor-ew-resize hover:bg-slate-900 flex items-center justify-center z-10"
                    onMouseDown={(e) => handleDragStart(index, e)}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                  >
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend below timeline */}
      <div className="flex items-center justify-between text-sm border-t pt-2">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-slate-600">Ball Rolling (ON)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-red-400 rounded" />
            <span className="text-slate-600">Ball Not Rolling (OFF)</span>
          </span>
        </div>
        <div className="flex gap-4 text-slate-500">
          <span>Total Rolling: {formatTime(session.ballRollingTime || 0)}</span>
          <span>Total Not Rolling: {formatTime(session.ballNotRollingTime || 0)}</span>
        </div>
      </div>
      
      {/* Segment list - detailed view */}
      {segments.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase">Timeline Events</p>
          <div className="grid gap-1 text-xs">
            {segments.map((seg, index) => (
              <div key={seg.id} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded">
                <span className="text-slate-400 w-6">{index + 1}.</span>
                <span className="font-mono w-16">{formatTimestamp(seg.startMs)}</span>
                <span className="text-slate-400">→</span>
                <span className="font-mono w-16">{formatTimestamp(seg.endMs)}</span>
                <Badge 
                  className={cn(
                    "text-xs",
                    seg.type === 'rolling' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {seg.type === 'rolling' ? 'Rolling' : 'Not Rolling'}
                </Badge>
                <span className="text-slate-400 ml-auto">
                  ({formatTimestamp(seg.endMs - seg.startMs)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Session Parts Timeline Editor
 * Shows ONLY parts that were actually activated during the session
 * Parts are displayed based on their recorded start/end times or 'used' flag
 */
function SessionPartsTimelineEditor({ parts, totalDurationMs, onUpdatePart, onDeletePart, onReorderParts, sessionStartTime }) {
  const [draggedPart, setDraggedPart] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingPartId, setEditingPartId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const sessionStartMs = sessionStartTime ? new Date(sessionStartTime).getTime() : 0;

  // Filter to only show parts that were actually used during the session
  const activatedParts = parts.filter(part => {
    // Part is considered activated if:
    // 1. It has 'used: true' flag (explicitly marked as used during observation)
    // 2. It has a startTime recorded (was started during observation)
    // 3. It has any ball rolling/not rolling time recorded (had activity)
    const hasUsedFlag = part.used === true;
    const hasStartTime = !!part.startTime;
    const hasRollingTime = (part.ballRollingTime && part.ballRollingTime > 0);
    const hasNotRollingTime = (part.ballNotRollingTime && part.ballNotRollingTime > 0);
    
    return hasUsedFlag || hasStartTime || hasRollingTime || hasNotRollingTime;
  });

  // Calculate part positions based on actual recorded times
  const getPartTimings = () => {
    if (activatedParts.length === 0) return [];
    
    // Sort by start time if available, otherwise by order field
    const sortedParts = [...activatedParts].sort((a, b) => {
      if (a.startTime && b.startTime) {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
      return (a.order || 0) - (b.order || 0);
    });
    
    // Calculate total time to distribute parts proportionally
    const totalPartTime = sortedParts.reduce((sum, part) => {
      return sum + (part.ballRollingTime || 0) + (part.ballNotRollingTime || 0);
    }, 0);
    
    let currentPosition = 0;
    
    return sortedParts.map((part, index) => {
      const partTotalTime = (part.ballRollingTime || 0) + (part.ballNotRollingTime || 0);
      
      let startMs, endMs;
      
      if (part.startTime && sessionStartMs) {
        // Use actual recorded start time
        startMs = new Date(part.startTime).getTime() - sessionStartMs;
        
        if (part.endTime) {
          endMs = new Date(part.endTime).getTime() - sessionStartMs;
        } else {
          // Calculate end from duration
          endMs = startMs + (partTotalTime * 1000);
        }
      } else if (totalPartTime > 0) {
        // Distribute proportionally based on recorded times
        const partWidthMs = (partTotalTime / totalPartTime) * totalDurationMs;
        startMs = currentPosition;
        endMs = currentPosition + partWidthMs;
        currentPosition = endMs;
      } else {
        // Fallback: distribute evenly
        const partWidth = totalDurationMs / sortedParts.length;
        startMs = index * partWidth;
        endMs = (index + 1) * partWidth;
      }
      
      return {
        ...part,
        startMs: Math.max(0, startMs),
        endMs: Math.min(totalDurationMs, endMs),
        partTotalTime,
        color: PART_COLORS[index % PART_COLORS.length]
      };
    });
  };

  const partTimings = getPartTimings();

  const handleDragStart = (e, index) => {
    setDraggedPart(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedPart !== null && draggedPart !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    if (draggedPart !== null && draggedPart !== toIndex) {
      onReorderParts(draggedPart, toIndex);
    }
    setDraggedPart(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedPart(null);
    setDragOverIndex(null);
  };

  const startEditing = (part) => {
    setEditingPartId(part.id);
    setEditingName(part.name);
  };

  const savePartName = (partId) => {
    if (editingName.trim()) {
      onUpdatePart(partId, { name: editingName.trim() });
    }
    setEditingPartId(null);
    setEditingName('');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show message if no parts were activated
  if (activatedParts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-600 font-medium">No session parts were activated</p>
          <p className="text-sm text-slate-500 mt-1">
            Parts shown here reflect what was actually used during this observation
          </p>
        </div>
        
        {/* Show all available parts that weren't used */}
        {parts.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Available Parts (Not Activated)</p>
            <div className="flex flex-wrap gap-2">
              {parts.filter(p => !activatedParts.includes(p)).map((part, idx) => (
                <Badge key={part.id} variant="outline" className="text-slate-400">
                  {part.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded border border-blue-100">
        Showing {activatedParts.length} of {parts.length} parts that were activated during this session
      </div>
      
      {/* Visual Timeline */}
      <div className="relative h-16 bg-slate-100 rounded-lg overflow-hidden">
        {partTimings.map((part, index) => {
          const leftPercent = (part.startMs / totalDurationMs) * 100;
          const widthPercent = ((part.endMs - part.startMs) / totalDurationMs) * 100;
          
          return (
            <div
              key={part.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "absolute top-0 bottom-0 flex flex-col items-center justify-center text-white text-xs font-medium cursor-move transition-all border-r-2 border-white",
                part.color,
                draggedPart === index && "opacity-50",
                dragOverIndex === index && "ring-2 ring-orange-400"
              )}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <span className="truncate px-2 font-semibold">{part.name}</span>
              {part.partTotalTime > 0 && (
                <span className="text-[10px] opacity-80">{formatDuration(part.partTotalTime)}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Time markers */}
      <div className="flex justify-between text-xs text-slate-400 px-1">
        <span>0:00</span>
        <span>{formatDuration(totalDurationMs / 2000)}</span>
        <span>{formatDuration(totalDurationMs / 1000)}</span>
      </div>

      {/* Part List for detailed editing */}
      <div className="space-y-2 mt-4">
        <p className="text-sm font-medium text-slate-700">Activated Parts (drag to reorder)</p>
        {activatedParts.map((part, index) => (
          <div
            key={part.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-3 p-3 border rounded-lg bg-white transition-all",
              draggedPart === index && "opacity-50",
              dragOverIndex === index && "border-orange-400 bg-orange-50"
            )}
          >
            <Move className="w-4 h-4 text-slate-400 cursor-grab" />
            
            <div className={cn("w-4 h-4 rounded", PART_COLORS[index % PART_COLORS.length])} />
            
            <Badge variant="outline" className="text-xs">
              {index + 1}
            </Badge>
            
            {editingPartId === part.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePartName(part.id);
                    if (e.key === 'Escape') setEditingPartId(null);
                  }}
                />
                <Button size="sm" variant="ghost" onClick={() => savePartName(part.id)}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingPartId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium">{part.name}</span>
                  {/* Show ball rolling breakdown */}
                  {(part.ballRollingTime > 0 || part.ballNotRollingTime > 0) && (
                    <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                      {part.ballRollingTime > 0 && (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded" />
                          {formatDuration(part.ballRollingTime)}
                        </span>
                      )}
                      {part.ballNotRollingTime > 0 && (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded" />
                          {formatDuration(part.ballNotRollingTime)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => startEditing(part)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Session Part?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove "{part.name}" from the session. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeletePart(part.id)} className="bg-red-600 hover:bg-red-700">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Event Edit Dialog
 */
function EventEditDialog({
  event,
  interventionTypes,
  descriptorGroup1,
  descriptorGroup2,
  sessionParts,
  onSave,
  onClose
}) {
  const [editedEvent, setEditedEvent] = useState({ ...event });

  const toggleDescriptor = (group, descriptorId) => {
    const key = group === 1 ? 'descriptors1' : 'descriptors2';
    const current = editedEvent[key] || [];
    
    if (current.includes(descriptorId)) {
      setEditedEvent(prev => ({ ...prev, [key]: current.filter(d => d !== descriptorId) }));
    } else {
      setEditedEvent(prev => ({ ...prev, [key]: [...current, descriptorId] }));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Intervention</DialogTitle>
          <DialogDescription>Modify the details of this intervention</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Intervention Type</Label>
            <Select
              value={editedEvent.eventTypeId}
              onValueChange={(value) => {
                const type = interventionTypes.find(t => t.id === value);
                setEditedEvent(prev => ({ ...prev, eventTypeId: value, eventTypeName: type?.name || value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {interventionTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Timestamp (MM:SS)</Label>
            <Input
              type="text"
              value={formatRelativeTime(editedEvent.relativeTimestamp)}
              onChange={(e) => {
                const ms = parseTimeToMs(e.target.value);
                setEditedEvent(prev => ({ ...prev, relativeTimestamp: ms }));
              }}
              placeholder="00:00"
            />
          </div>

          <div className="space-y-2">
            <Label>Session Part</Label>
            <Select
              value={editedEvent.partId || ''}
              onValueChange={(value) => setEditedEvent(prev => ({ ...prev, partId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select part" />
              </SelectTrigger>
              <SelectContent>
                {sessionParts.map(part => (
                  <SelectItem key={part.id} value={part.id}>{part.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {descriptorGroup1 && (
            <div className="space-y-2">
              <Label>{descriptorGroup1.name}</Label>
              <div className="flex flex-wrap gap-2">
                {(descriptorGroup1.descriptors || []).map(desc => (
                  <Badge
                    key={desc.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      (editedEvent.descriptors1 || []).includes(desc.id)
                        ? "bg-sky-500 text-white"
                        : "bg-sky-100 text-sky-800 hover:bg-sky-200"
                    )}
                    onClick={() => toggleDescriptor(1, desc.id)}
                  >
                    {desc.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {descriptorGroup2 && (
            <div className="space-y-2">
              <Label>{descriptorGroup2.name}</Label>
              <div className="flex flex-wrap gap-2">
                {(descriptorGroup2.descriptors || []).map(desc => (
                  <Badge
                    key={desc.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      (editedEvent.descriptors2 || []).includes(desc.id)
                        ? "bg-green-500 text-white"
                        : "bg-green-100 text-green-800 hover:bg-green-200"
                    )}
                    onClick={() => toggleDescriptor(2, desc.id)}
                  >
                    {desc.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note</Label>
            <Input
              value={editedEvent.note || ''}
              onChange={(e) => setEditedEvent(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Add a note..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(editedEvent); onClose(); }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SessionEditTimeline;
