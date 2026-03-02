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
 * Ball Rolling Timeline Editor - FIXED VERSION
 * Properly persists drag changes to the parent state
 */
function BallRollingTimelineEditor({ session, onChange }) {
  const containerRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [dragging, setDragging] = useState(null);
  const segmentsRef = useRef(segments);

  // Keep ref in sync with state
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const totalMs = (session.totalDuration || 1) * 1000;

  // Build segments from session data
  useEffect(() => {
    const rollingMs = (session.ballRollingTime || 0) * 1000;
    const notRollingMs = (session.ballNotRollingTime || 0) * 1000;
    const total = rollingMs + notRollingMs || totalMs;
    
    // Simple two-segment model: rolling first, then not rolling
    setSegments([
      { id: 'rolling', type: 'rolling', start: 0, end: rollingMs },
      { id: 'not_rolling', type: 'not_rolling', start: rollingMs, end: total }
    ]);
  }, [session.ballRollingTime, session.ballNotRollingTime, totalMs]);

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
        const minEnd = seg.start + 1000;
        const maxEnd = totalMs - 1000;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, newEndMs));
        
        updated[dragging.index] = { ...seg, end: clampedEnd };
        updated[dragging.index + 1] = { ...nextSeg, start: clampedEnd };
      }
      return updated;
    });
  }, [dragging, totalMs]);

  const handleDragEnd = useCallback(() => {
    if (!dragging) return;
    
    // Use the ref to get the latest segments state
    const currentSegments = segmentsRef.current;
    
    let rollingTime = 0;
    let notRollingTime = 0;
    
    currentSegments.forEach(seg => {
      const duration = (seg.end - seg.start) / 1000;
      if (seg.type === 'rolling') {
        rollingTime += duration;
      } else {
        notRollingTime += duration;
      }
    });
    
    // IMPORTANT: Call onChange to persist changes to parent state
    onChange({
      ballRollingTime: Math.max(0, rollingTime),
      ballNotRollingTime: Math.max(0, notRollingTime)
    });
    
    setDragging(null);
  }, [dragging, onChange]);

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

  // Touch support for mobile
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
        const minEnd = seg.start + 1000;
        const maxEnd = totalMs - 1000;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, newEndMs));
        
        updated[dragging.index] = { ...seg, end: clampedEnd };
        updated[dragging.index + 1] = { ...nextSeg, start: clampedEnd };
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

  return (
    <div className="space-y-2">
      {/* Timeline */}
      <div 
        ref={containerRef}
        className="relative h-12 bg-slate-200 rounded-lg overflow-hidden select-none"
      >
        {segments.map((seg, index) => {
          const leftPercent = (seg.start / totalMs) * 100;
          const widthPercent = ((seg.end - seg.start) / totalMs) * 100;
          
          return (
            <div
              key={seg.id}
              className={cn(
                "absolute top-0 bottom-0 flex items-center justify-center text-white text-xs font-medium",
                seg.type === 'rolling' ? "bg-green-500" : "bg-red-400"
              )}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              {widthPercent > 15 && formatRelativeTime((seg.end - seg.start))}
              
              {/* Drag handle at the end of segment (except last) */}
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
      
      {/* Legend - MOVED BELOW the timeline */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-slate-600">Ball Rolling</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-red-400 rounded" />
            <span className="text-slate-600">Ball Not Rolling</span>
          </span>
        </div>
        <div className="flex gap-4 text-slate-500">
          <span>Rolling: {formatTime(session.ballRollingTime || 0)}</span>
          <span>Not Rolling: {formatTime(session.ballNotRollingTime || 0)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Session Parts Timeline Editor
 * Visual timeline with drag-and-drop reordering and duration editing
 */
function SessionPartsTimelineEditor({ parts, totalDurationMs, onUpdatePart, onDeletePart, onReorderParts }) {
  const [draggedPart, setDraggedPart] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingPartId, setEditingPartId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Calculate part positions on timeline
  const getPartTimings = () => {
    if (parts.length === 0) return [];
    
    // Distribute parts evenly if no timing data
    const partDuration = totalDurationMs / parts.length;
    return parts.map((part, index) => ({
      ...part,
      startMs: index * partDuration,
      endMs: (index + 1) * partDuration,
      color: PART_COLORS[index % PART_COLORS.length]
    }));
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

  if (parts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No session parts defined</p>
        <p className="text-sm mt-1">Click "Add Part" to create segments</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                "absolute top-0 bottom-0 flex items-center justify-center text-white text-xs font-medium cursor-move transition-all border-r-2 border-white",
                part.color,
                draggedPart === index && "opacity-50",
                dragOverIndex === index && "ring-2 ring-orange-400"
              )}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <span className="truncate px-2">{part.name}</span>
            </div>
          );
        })}
      </div>

      {/* Time markers */}
      <div className="flex justify-between text-xs text-slate-400 px-1">
        <span>0:00</span>
        <span>{formatRelativeTime(totalDurationMs / 2)}</span>
        <span>{formatRelativeTime(totalDurationMs)}</span>
      </div>

      {/* Part List for detailed editing */}
      <div className="space-y-2 mt-4">
        <p className="text-sm font-medium text-slate-700">Parts (drag to reorder)</p>
        {parts.map((part, index) => (
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
                <span className="flex-1 font-medium">{part.name}</span>
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
