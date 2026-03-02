import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Trash2, Edit2, Save, X, Clock, ChevronLeft, ChevronRight, GripVertical, AlertTriangle } from 'lucide-react';
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
    // MM:SS
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    // HH:MM:SS
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
};

// Format milliseconds to input-friendly HH:MM:SS
const msToInputTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Session Edit Timeline Component
 * Allows editing of completed sessions including:
 * - Session start/end times
 * - Interventions (remove, change type, edit descriptors)
 * - Session parts/segments
 * - Ball rolling timeline
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
  // Editable session state
  const [editedSession, setEditedSession] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState(null);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  
  // Ball rolling timeline state
  const [draggingSegment, setDraggingSegment] = useState(null);
  const timelineRef = useRef(null);

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
  const sessionStartTime = editedSession.startTime ? new Date(editedSession.startTime) : null;
  const sessionEndTime = editedSession.endTime ? new Date(editedSession.endTime) : null;

  // Update session times
  const handleTimeChange = (field, value) => {
    const newTime = new Date(value);
    
    setEditedSession(prev => {
      const updated = { ...prev, [field]: newTime.toISOString() };
      
      // Recalculate total duration if both times are set
      if (updated.startTime && updated.endTime) {
        const start = new Date(updated.startTime);
        const end = new Date(updated.endTime);
        const duration = (end - start) / 1000; // in seconds
        
        if (duration < 0) {
          setShowTimeWarning(true);
          return prev; // Don't allow end before start
        }
        
        updated.totalDuration = duration;
        
        // Auto-adjust events that fall outside new time bounds
        if (field === 'startTime') {
          const diff = start.getTime() - new Date(prev.startTime).getTime();
          updated.events = (prev.events || []).map(e => {
            if (e.timestamp) {
              const eventTime = new Date(e.timestamp).getTime();
              const relativeTime = e.relativeTimestamp || 0;
              // Keep relative times, they will be recalculated on save
              return e;
            }
            return e;
          });
        }
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
    setDeleteConfirmEvent(null);
    toast.success('Intervention removed');
  };

  // Update event timestamp
  const handleEventTimestampChange = (eventId, newRelativeMs) => {
    const sessionStart = new Date(editedSession.startTime).getTime();
    const sessionEnd = new Date(editedSession.endTime).getTime();
    const sessionDurationMs = sessionEnd - sessionStart;
    
    // Clamp to session bounds
    const clampedMs = Math.max(0, Math.min(newRelativeMs, sessionDurationMs));
    
    setEditedSession(prev => {
      const updatedEvents = (prev.events || []).map(e => {
        if (e.id === eventId) {
          const newTimestamp = new Date(sessionStart + clampedMs).toISOString();
          return { 
            ...e, 
            relativeTimestamp: clampedMs,
            timestamp: newTimestamp
          };
        }
        return e;
      });
      
      // Sort events by timestamp
      updatedEvents.sort((a, b) => (a.relativeTimestamp || 0) - (b.relativeTimestamp || 0));
      
      return { ...prev, events: updatedEvents };
    });
    setIsDirty(true);
  };

  // Update ball rolling segment
  const handleBallRollingUpdate = (index, newEndTime) => {
    setEditedSession(prev => {
      const log = [...(prev.ballRollingLog || [])];
      if (log[index]) {
        // Update this segment's end (which is the next segment's start)
        // Or recalculate ball rolling times based on the log
      }
      return prev;
    });
    setIsDirty(true);
  };

  // Update session part
  const handlePartUpdate = (partId, updates) => {
    setEditedSession(prev => ({
      ...prev,
      sessionParts: (prev.sessionParts || []).map(p =>
        p.id === partId ? { ...p, ...updates } : p
      )
    }));
    setIsDirty(true);
  };

  // Recalculate derived values before save
  const recalculateDerivedValues = (sessionData) => {
    const events = sessionData.events || [];
    const ballRollingLog = sessionData.ballRollingLog || [];
    
    // Recalculate total duration from times
    if (sessionData.startTime && sessionData.endTime) {
      const start = new Date(sessionData.startTime).getTime();
      const end = new Date(sessionData.endTime).getTime();
      sessionData.totalDuration = Math.max(0, (end - start) / 1000);
    }
    
    // Recalculate ball rolling/not rolling times from log
    if (ballRollingLog.length > 0) {
      let ballRollingTime = 0;
      let ballNotRollingTime = 0;
      
      const sortedLog = [...ballRollingLog].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      for (let i = 0; i < sortedLog.length; i++) {
        const current = sortedLog[i];
        const nextTimestamp = sortedLog[i + 1]?.timestamp || sessionData.endTime;
        
        if (nextTimestamp) {
          const duration = (new Date(nextTimestamp).getTime() - new Date(current.timestamp).getTime()) / 1000;
          if (current.state) {
            ballRollingTime += duration;
          } else {
            ballNotRollingTime += duration;
          }
        }
      }
      
      sessionData.ballRollingTime = ballRollingTime;
      sessionData.ballNotRollingTime = ballNotRollingTime;
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
    const durationMs = (editedSession.totalDuration || 1) * 1000;
    return Math.min(100, Math.max(0, (ms / durationMs) * 100));
  };

  return (
    <div className="space-y-6">
      {/* Edit Mode Header */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
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
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save Changes
                  </>
                )}
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
                <span className="text-slate-700 font-mono">
                  {formatTime(editedSession.totalDuration || 0)}
                </span>
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
            Drag the segments to adjust ball rolling/not rolling periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BallRollingTimelineEditor
            session={editedSession}
            onChange={(updates) => {
              setEditedSession(prev => ({ ...prev, ...updates }));
              setIsDirty(true);
            }}
          />
          <div className="flex justify-between mt-2 text-sm text-slate-500">
            <span>Ball Rolling: {formatTime(editedSession.ballRollingTime || 0)}</span>
            <span>Ball Not Rolling: {formatTime(editedSession.ballNotRollingTime || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Session Parts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Parts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(editedSession.sessionParts || []).map((part, index) => (
              <div key={part.id} className="flex items-center gap-3 p-2 border rounded-lg">
                <Badge variant="outline">{index + 1}</Badge>
                <Input
                  value={part.name}
                  onChange={(e) => handlePartUpdate(part.id, { name: e.target.value })}
                  className="flex-1"
                />
                {part.used && (
                  <span className="text-xs text-slate-500">
                    {formatTime(part.ballRollingTime + part.ballNotRollingTime || 0)}
                  </span>
                )}
              </div>
            ))}
          </div>
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
          <div className="relative h-12 bg-slate-100 rounded-lg mb-4" ref={timelineRef}>
            {/* Time markers */}
            <div className="absolute inset-0 flex justify-between px-2 items-end pb-1 text-xs text-slate-400">
              <span>0:00</span>
              <span>{formatTime((editedSession.totalDuration || 0) / 2)}</span>
              <span>{formatTime(editedSession.totalDuration || 0)}</span>
            </div>
            
            {/* Event markers */}
            {(editedSession.events || []).map((event, idx) => {
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
            {(editedSession.events || []).map((event, idx) => (
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

                {/* Descriptors */}
                <div className="flex-1 flex flex-wrap gap-1">
                  {(event.descriptors1 || []).map(d => {
                    const desc = descriptorGroup1?.descriptors?.find(x => x.id === d);
                    return desc && (
                      <Badge key={d} className="bg-sky-100 text-sky-800 text-xs">
                        {desc.name}
                      </Badge>
                    );
                  })}
                  {(event.descriptors2 || []).map(d => {
                    const desc = descriptorGroup2?.descriptors?.find(x => x.id === d);
                    return desc && (
                      <Badge key={d} className="bg-green-100 text-green-800 text-xs">
                        {desc.name}
                      </Badge>
                    );
                  })}
                </div>

                {/* Delete Button */}
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
 * Ball Rolling Timeline Editor
 * Allows dragging segments to adjust ball rolling/not rolling periods
 */
function BallRollingTimelineEditor({ session, onChange }) {
  const containerRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [dragging, setDragging] = useState(null);

  // Build segments from ball rolling log
  useEffect(() => {
    const log = session.ballRollingLog || [];
    if (log.length === 0) {
      // No log - create single segment based on ball rolling time
      const totalMs = (session.totalDuration || 0) * 1000;
      const rollingMs = (session.ballRollingTime || 0) * 1000;
      
      setSegments([
        { id: 'rolling', type: 'rolling', start: 0, end: rollingMs },
        { id: 'not_rolling', type: 'not_rolling', start: rollingMs, end: totalMs }
      ]);
      return;
    }

    // Build segments from log
    const sessionStart = new Date(session.startTime).getTime();
    const sessionEnd = new Date(session.endTime).getTime();
    const totalMs = sessionEnd - sessionStart;
    
    const sortedLog = [...log].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const newSegments = [];
    for (let i = 0; i < sortedLog.length; i++) {
      const current = sortedLog[i];
      const startMs = new Date(current.timestamp).getTime() - sessionStart;
      const endMs = sortedLog[i + 1] 
        ? new Date(sortedLog[i + 1].timestamp).getTime() - sessionStart
        : totalMs;
      
      newSegments.push({
        id: `seg_${i}`,
        type: current.state ? 'rolling' : 'not_rolling',
        start: Math.max(0, startMs),
        end: Math.min(totalMs, endMs)
      });
    }
    
    setSegments(newSegments);
  }, [session]);

  const totalMs = (session.totalDuration || 1) * 1000;

  const handleDragStart = (index, e) => {
    e.preventDefault();
    setDragging({ index, startX: e.clientX });
  };

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
        // Update this segment's end and next segment's start
        const nextSeg = updated[dragging.index + 1];
        const minEnd = seg.start + 1000; // At least 1 second
        const maxEnd = nextSeg.end - 1000;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, newEndMs));
        
        updated[dragging.index] = { ...seg, end: clampedEnd };
        updated[dragging.index + 1] = { ...nextSeg, start: clampedEnd };
      }
      return updated;
    });
  }, [dragging, totalMs]);

  const handleDragEnd = useCallback(() => {
    if (!dragging) return;
    
    // Calculate new ball rolling times from segments
    let rollingTime = 0;
    let notRollingTime = 0;
    
    segments.forEach(seg => {
      const duration = (seg.end - seg.start) / 1000;
      if (seg.type === 'rolling') {
        rollingTime += duration;
      } else {
        notRollingTime += duration;
      }
    });
    
    onChange({
      ballRollingTime: rollingTime,
      ballNotRollingTime: notRollingTime
    });
    
    setDragging(null);
  }, [dragging, segments, onChange]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [dragging, handleDrag, handleDragEnd]);

  return (
    <div 
      ref={containerRef}
      className="relative h-10 bg-slate-200 rounded-lg overflow-hidden cursor-pointer"
    >
      {segments.map((seg, index) => {
        const leftPercent = (seg.start / totalMs) * 100;
        const widthPercent = ((seg.end - seg.start) / totalMs) * 100;
        
        return (
          <div
            key={seg.id}
            className={cn(
              "absolute top-0 bottom-0 transition-colors",
              seg.type === 'rolling' ? "bg-green-400" : "bg-red-300"
            )}
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`
            }}
          >
            {/* Drag handle at the end of segment (except last) */}
            {index < segments.length - 1 && (
              <div
                className="absolute right-0 top-0 bottom-0 w-2 bg-slate-600 cursor-ew-resize hover:bg-slate-800 flex items-center justify-center"
                onMouseDown={(e) => handleDragStart(index, e)}
              >
                <GripVertical className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        );
      })}
      
      {/* Legend */}
      <div className="absolute bottom-0 right-0 flex gap-2 p-1 text-xs">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-400 rounded" /> Rolling
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-300 rounded" /> Not Rolling
        </span>
      </div>
    </div>
  );
}

/**
 * Event Edit Dialog
 * Detailed editing of a single intervention event
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
      setEditedEvent(prev => ({
        ...prev,
        [key]: current.filter(d => d !== descriptorId)
      }));
    } else {
      setEditedEvent(prev => ({
        ...prev,
        [key]: [...current, descriptorId]
      }));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Intervention</DialogTitle>
          <DialogDescription>
            Modify the details of this intervention
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Intervention Type */}
          <div className="space-y-2">
            <Label>Intervention Type</Label>
            <Select
              value={editedEvent.eventTypeId}
              onValueChange={(value) => {
                const type = interventionTypes.find(t => t.id === value);
                setEditedEvent(prev => ({
                  ...prev,
                  eventTypeId: value,
                  eventTypeName: type?.name || value
                }));
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

          {/* Timestamp */}
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

          {/* Session Part */}
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

          {/* Descriptor Group 1 */}
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

          {/* Descriptor Group 2 */}
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

          {/* Note */}
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
          <Button onClick={() => { onSave(editedEvent); onClose(); }}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SessionEditTimeline;
