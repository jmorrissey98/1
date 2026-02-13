import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, GripVertical, Play, User, Calendar, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { storage, createSession, getDefaultTemplate, OBSERVATION_CONTEXTS } from '../lib/storage';
import { fetchSessionParts, createSessionPart, toFrontendFormat } from '../lib/sessionPartsApi';
import { fetchReflectionTemplates } from '../lib/reflectionTemplatesApi';
import { generateId, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { safeGet } from '../lib/safeFetch';

const API_URL = '';

export default function SessionSetup() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedCoachId = searchParams.get('coachId');
  const plannedDate = searchParams.get('date');
  const isEditing = !!sessionId;
  const { isCoachDeveloper } = useAuth();
  const { getSession, saveSession: cloudSaveSession, setCurrentSession } = useCloudSync();
  
  const [templates, setTemplates] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [selectedCoachId, setSelectedCoachId] = useState(preselectedCoachId || 'none');
  const [observationContext, setObservationContext] = useState(OBSERVATION_CONTEXTS.TRAINING);
  const [sessionDate, setSessionDate] = useState(plannedDate || '');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Session parts state
  const [availableParts, setAvailableParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [showCustomPartDialog, setShowCustomPartDialog] = useState(false);
  const [customPartName, setCustomPartName] = useState('');
  const [savingPart, setSavingPart] = useState(false);
  
  // Reflection template state (Phase 4)
  const [reflectionTemplates, setReflectionTemplates] = useState([]);
  const [selectedReflectionTemplateId, setSelectedReflectionTemplateId] = useState('default');
  const [enableObserverNotes, setEnableObserverNotes] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      loadSessionParts();
      loadCoaches();
      setTemplates(storage.getTemplates());
      
      if (isEditing) {
        // Load existing session from cloud
        try {
          const existing = await getSession(sessionId);
          if (existing) {
            setSession(existing);
            setSelectedCoachId(existing.coachId || 'none');
            // Also restore the planned date if it exists
            if (existing.plannedDate) {
              setSessionDate(existing.plannedDate);
            }
          } else {
            toast.error('Session not found');
            navigate('/');
          }
        } catch (err) {
          console.error('Failed to load session:', err);
          toast.error('Failed to load session');
          navigate('/');
        }
      } else {
        const newSession = createSession('', null, preselectedCoachId || null, {
          observationContext: OBSERVATION_CONTEXTS.TRAINING,
          plannedDate: plannedDate || null,
          planned: !!plannedDate
        });
        setSession(newSession);
        if (plannedDate) setSessionDate(plannedDate);
      }
      setLoading(false);
    };
    
    initSession();
  }, [sessionId, isEditing, navigate, preselectedCoachId, plannedDate, getSession]);

  // Load coaches from API instead of localStorage
  const loadCoaches = async () => {
    try {
      const result = await safeGet(`${API_URL}/api/coaches`);
      if (result.ok && result.data) {
        setCoaches(result.data);
        
        // If coach is preselected, set a default session name
        if (preselectedCoachId) {
          const coach = result.data.find(c => c.id === preselectedCoachId);
          if (coach) {
            setSession(prev => prev ? {
              ...prev,
              name: `${coach.name} - ${new Date().toLocaleDateString()}`
            } : prev);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load coaches:', err);
      // Fallback to localStorage if API fails
      setCoaches(storage.getCoaches());
    }
  };

  const loadSessionParts = async () => {
    setLoadingParts(true);
    try {
      const parts = await fetchSessionParts();
      setAvailableParts(parts);
    } catch (err) {
      console.error('Failed to load session parts:', err);
    } finally {
      setLoadingParts(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId) || getDefaultTemplate();
    const interventions = template.interventionTypes || template.eventTypes;
    setSession(prev => ({
      ...prev,
      interventionTypes: [...interventions],
      eventTypes: [...interventions],
      descriptorGroup1: { ...template.descriptorGroup1, descriptors: [...template.descriptorGroup1.descriptors] },
      descriptorGroup2: { ...template.descriptorGroup2, descriptors: [...template.descriptorGroup2.descriptors] },
      sessionParts: template.sessionParts.map(p => ({
        ...p,
        startTime: null,
        endTime: null,
        ballRollingTime: 0,
        ballNotRollingTime: 0,
        used: false
      }))
    }));
  };

  const handleCoachChange = (coachId) => {
    setSelectedCoachId(coachId);
    updateSession({ coachId: coachId === 'none' ? null : coachId });
  };

  const handleContextChange = (context) => {
    setObservationContext(context);
    updateSession({ observationContext: context });
  };

  const handleDateChange = (date) => {
    setSessionDate(date);
    updateSession({ 
      plannedDate: date || null,
      status: date ? 'planned' : 'draft'
    });
  };

  const updateSession = (updates) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  // Event type management
  const addEventType = () => {
    const currentEventTypes = session.eventTypes || session.interventionTypes || [];
    const newEvent = { id: generateId('event'), name: 'New Event', color: 'yellow' };
    updateSession({ eventTypes: [...currentEventTypes, newEvent], interventionTypes: [...currentEventTypes, newEvent] });
  };

  const updateEventType = (id, name) => {
    const currentEventTypes = session.eventTypes || session.interventionTypes || [];
    const updated = currentEventTypes.map(e => e.id === id ? { ...e, name } : e);
    updateSession({
      eventTypes: updated,
      interventionTypes: updated
    });
  };

  const removeEventType = (id) => {
    const currentEventTypes = session.eventTypes || session.interventionTypes || [];
    if (currentEventTypes.length <= 1) {
      toast.error('You need at least one event type');
      return;
    }
    const filtered = currentEventTypes.filter(e => e.id !== id);
    updateSession({ eventTypes: filtered, interventionTypes: filtered });
  };

  // Descriptor management
  const addDescriptor = (groupNum) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey] || { name: `Descriptor Group ${groupNum}`, descriptors: [] };
    const newDesc = { id: generateId('desc'), name: 'New' };
    updateSession({
      [groupKey]: { ...group, descriptors: [...(group.descriptors || []), newDesc] }
    });
  };

  const updateDescriptor = (groupNum, id, name) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey] || { name: `Descriptor Group ${groupNum}`, descriptors: [] };
    updateSession({
      [groupKey]: {
        ...group,
        descriptors: (group.descriptors || []).map(d => d.id === id ? { ...d, name } : d)
      }
    });
  };

  const removeDescriptor = (groupNum, id) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey] || { name: `Descriptor Group ${groupNum}`, descriptors: [] };
    updateSession({
      [groupKey]: { ...group, descriptors: (group.descriptors || []).filter(d => d.id !== id) }
    });
  };

  const updateGroupName = (groupNum, name) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey] || { name: `Descriptor Group ${groupNum}`, descriptors: [] };
    updateSession({
      [groupKey]: { ...group, name }
    });
  };

  // Session parts management - now uses global defaults from backend
  const addSessionPartFromDefault = (part) => {
    const newPart = {
      id: generateId('part'),
      name: part.name,
      partId: part.part_id, // Reference to the global part
      order: (session.sessionParts || []).length,
      isDefault: part.is_default,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0
    };
    updateSession({ sessionParts: [...(session.sessionParts || []), newPart] });
  };

  const handleAddCustomPart = () => {
    setCustomPartName('');
    setShowCustomPartDialog(true);
  };

  const handleSaveCustomPart = async (addAsDefault) => {
    if (!customPartName.trim()) {
      toast.error('Please enter a part name');
      return;
    }

    setSavingPart(true);
    try {
      if (addAsDefault && isCoachDeveloper()) {
        // Create as new global default
        const newPart = await createSessionPart(customPartName.trim(), true);
        await loadSessionParts(); // Refresh the list
        addSessionPartFromDefault(newPart);
        toast.success('Session part added as new default');
      } else {
        // Add as one-off custom part for this session only
        const newPart = {
          id: generateId('part'),
          name: customPartName.trim(),
          order: (session.sessionParts || []).length,
          isDefault: false,
          isCustom: true,
          startTime: null,
          endTime: null,
          ballRollingTime: 0,
          ballNotRollingTime: 0
        };
        updateSession({ sessionParts: [...(session.sessionParts || []), newPart] });
        toast.success('Custom session part added');
      }
      setShowCustomPartDialog(false);
      setCustomPartName('');
    } catch (err) {
      toast.error(err.message || 'Failed to create session part');
    } finally {
      setSavingPart(false);
    }
  };

  const addSessionPart = () => {
    // Legacy function - now opens dialog for custom part
    handleAddCustomPart();
  };

  const updateSessionPart = (id, name) => {
    updateSession({
      sessionParts: (session.sessionParts || []).map(p => p.id === id ? { ...p, name } : p)
    });
  };

  const removeSessionPart = (id) => {
    if ((session.sessionParts || []).length <= 1) {
      toast.error('You need at least one session part');
      return;
    }
    updateSession({
      sessionParts: (session.sessionParts || []).filter(p => p.id !== id),
      activePartId: session.activePartId === id ? session.sessionParts[0].id : session.activePartId
    });
  };

  const handleSave = async () => {
    if (!session.name.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    
    const updated = {
      ...session,
      updatedAt: new Date().toISOString(),
      activePartId: session.activePartId || session.sessionParts[0]?.id
    };
    
    // Save to cloud and cache
    setCurrentSession(updated);
    await cloudSaveSession(updated);
    toast.success('Session saved');
    navigate('/');
  };

  const handleStartObservation = async () => {
    if (!session.name.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    
    // Validate coach selection
    if (!selectedCoachId || selectedCoachId === 'none') {
      toast.error('Please select a coach for this observation');
      return;
    }
    
    const updated = {
      ...session,
      updatedAt: new Date().toISOString(),
      activePartId: session.activePartId || session.sessionParts[0]?.id
    };
    
    // Save to cloud and cache before navigating
    setCurrentSession(updated);
    await cloudSaveSession(updated);
    navigate(`/session/${session.id}/observe`);
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Ensure session has all required properties with defaults
  const eventTypes = session.eventTypes || session.interventionTypes || [];
  const descriptorGroup1 = session.descriptorGroup1 || { name: 'Descriptor Group 1', descriptors: [] };
  const descriptorGroup2 = session.descriptorGroup2 || { name: 'Descriptor Group 2', descriptors: [] };
  const sessionParts = session.sessionParts || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">
                {isEditing ? 'Edit Session' : 'New Session'}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} data-testid="save-session-btn">
              Save
            </Button>
            <Button onClick={handleStartObservation} className="bg-orange-500 hover:bg-orange-600" data-testid="start-observation-btn">
              <Play className="w-4 h-4 mr-1" />
              Start Observation
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Coach Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <User className="w-5 h-5" />
              Coach
            </CardTitle>
            <CardDescription>
              Select the coach being observed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCoachId} onValueChange={handleCoachChange}>
              <SelectTrigger data-testid="coach-select" className={selectedCoachId === 'none' ? 'text-slate-400' : ''}>
                <SelectValue placeholder="Select a coach..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-slate-500">No linked coach</SelectItem>
                {coaches.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.role_title && ` - ${c.role_title}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {coaches.length === 0 && (
              <p className="text-sm text-slate-500 mt-2">
                No coaches yet. <button className="text-blue-600 hover:underline" onClick={() => navigate('/coaches')}>Add a coach</button> to track their development over time.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Observation Context */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Observation Type</CardTitle>
            <CardDescription>
              Select the context for this observation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleContextChange(OBSERVATION_CONTEXTS.TRAINING)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  observationContext === OBSERVATION_CONTEXTS.TRAINING
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
                data-testid="context-training"
              >
                <div className="font-semibold text-slate-900">Training Observation</div>
                <div className="text-sm text-slate-500 mt-1">Observe a training session</div>
              </button>
              <button
                type="button"
                onClick={() => handleContextChange(OBSERVATION_CONTEXTS.GAME)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  observationContext === OBSERVATION_CONTEXTS.GAME
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
                data-testid="context-game"
              >
                <div className="font-semibold text-slate-900">Game Observation</div>
                <div className="text-sm text-slate-500 mt-1">Observe during a match or game</div>
              </button>
            </div>
            
            {/* Planned Date */}
            <div>
              <Label htmlFor="session-date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule for Later (Optional)
              </Label>
              <Input
                id="session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="mt-1 max-w-xs"
                data-testid="session-date-input"
              />
              {sessionDate && (
                <p className="text-sm text-slate-500 mt-1">
                  This session will be marked as planned and appear in your calendar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Name & Template */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                value={session.name}
                onChange={(e) => updateSession({ name: e.target.value })}
                placeholder="e.g., U14 Training - 15 Jan"
                className="mt-1"
                data-testid="session-name-input"
              />
            </div>
            {!isEditing && (
              <div>
                <Label htmlFor="template">Start from Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="mt-1" data-testid="template-select">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Types */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-['Manrope']">Event Types</CardTitle>
            <Button size="sm" variant="outline" onClick={addEventType} data-testid="add-event-type-btn">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">These are the coaching interventions you want to track (shown as yellow buttons).</p>
            <div className="space-y-2">
              {eventTypes.map((event) => (
                <div key={event.id} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  <div className="w-4 h-4 rounded bg-yellow-400" />
                  <Input
                    value={event.name}
                    onChange={(e) => updateEventType(event.id, e.target.value)}
                    className="flex-1"
                    data-testid={`event-type-input-${event.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeEventType(event.id)}
                    data-testid={`remove-event-${event.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Descriptor Group 1 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-sky-400" />
              <Input
                value={descriptorGroup1.name}
                onChange={(e) => updateGroupName(1, e.target.value)}
                className="font-semibold border-0 p-0 h-auto text-lg focus-visible:ring-0"
                data-testid="descriptor-group-1-name"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => addDescriptor(1)} data-testid="add-descriptor-1-btn">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(descriptorGroup1.descriptors || []).map((desc) => (
                <div key={desc.id} className="flex items-center gap-1 bg-sky-100 rounded-lg pl-3 pr-1 py-1">
                  <Input
                    value={desc.name}
                    onChange={(e) => updateDescriptor(1, desc.id, e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto w-24 focus-visible:ring-0"
                    data-testid={`descriptor-1-input-${desc.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                    onClick={() => removeDescriptor(1, desc.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Descriptor Group 2 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-400" />
              <Input
                value={descriptorGroup2.name}
                onChange={(e) => updateGroupName(2, e.target.value)}
                className="font-semibold border-0 p-0 h-auto text-lg focus-visible:ring-0"
                data-testid="descriptor-group-2-name"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => addDescriptor(2)} data-testid="add-descriptor-2-btn">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(descriptorGroup2.descriptors || []).map((desc) => (
                <div key={desc.id} className="flex items-center gap-1 bg-green-100 rounded-lg pl-3 pr-1 py-1">
                  <Input
                    value={desc.name}
                    onChange={(e) => updateDescriptor(2, desc.id, e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto w-24 focus-visible:ring-0"
                    data-testid={`descriptor-2-input-${desc.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                    onClick={() => removeDescriptor(2, desc.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Session Parts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-['Manrope']">Session Parts</CardTitle>
              <CardDescription>Select from defaults or create custom parts</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Available Default Parts */}
            <div>
              <Label className="text-sm text-slate-600 mb-2 block">Add from defaults:</Label>
              {loadingParts ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading session parts...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableParts.filter(p => p.is_default).map(part => {
                    const isAdded = (session.sessionParts || []).some(sp => sp.name === part.name);
                    return (
                      <Button
                        key={part.part_id}
                        size="sm"
                        variant={isAdded ? "secondary" : "outline"}
                        onClick={() => !isAdded && addSessionPartFromDefault(part)}
                        disabled={isAdded}
                        className={isAdded ? "opacity-50" : ""}
                        data-testid={`add-default-part-${part.part_id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {part.name}
                        {isAdded && " ✓"}
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCustomPart}
                    className="border-dashed"
                    data-testid="add-custom-part-btn"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Custom Part
                  </Button>
                </div>
              )}
            </div>

            {/* Selected Session Parts */}
            <div>
              <Label className="text-sm text-slate-600 mb-2 block">Parts for this session:</Label>
              {(session.sessionParts || []).length === 0 ? (
                <p className="text-sm text-slate-400 italic">No parts added yet. Select from defaults above.</p>
              ) : (
                <div className="space-y-2">
                  {(session.sessionParts || []).map((part, index) => (
                    <div key={part.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-400 w-6 font-medium">{index + 1}</span>
                      <Input
                        value={part.name}
                        onChange={(e) => updateSessionPart(part.id, e.target.value)}
                        className="flex-1 bg-white"
                        data-testid={`session-part-input-${part.id}`}
                      />
                      {part.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Default</span>
                      )}
                      {part.isCustom && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Custom</span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-600 h-8 w-8"
                        onClick={() => removeSessionPart(part.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Part Dialog */}
        <Dialog open={showCustomPartDialog} onOpenChange={setShowCustomPartDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Custom Session Part</DialogTitle>
              <DialogDescription>
                Enter a name for your custom session part.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="custom-part-name">Part Name</Label>
              <Input
                id="custom-part-name"
                value={customPartName}
                onChange={(e) => setCustomPartName(e.target.value)}
                placeholder="e.g., Cool Down"
                className="mt-1"
                data-testid="custom-part-name-input"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleSaveCustomPart(false)}
                disabled={savingPart || !customPartName.trim()}
              >
                {savingPart ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add as One-Off
              </Button>
              {isCoachDeveloper() && (
                <Button
                  onClick={() => handleSaveCustomPart(true)}
                  disabled={savingPart || !customPartName.trim()}
                >
                  {savingPart ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add as New Default
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
