import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, GripVertical, Play, User, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { storage, createSession, getDefaultTemplate, OBSERVATION_CONTEXTS } from '../lib/storage';
import { generateId } from '../lib/utils';

export default function SessionSetup() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedCoachId = searchParams.get('coachId');
  const plannedDate = searchParams.get('date');
  const isEditing = !!sessionId;
  
  const [templates, setTemplates] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [selectedCoachId, setSelectedCoachId] = useState(preselectedCoachId || 'none');
  const [observationContext, setObservationContext] = useState(OBSERVATION_CONTEXTS.TRAINING);
  const [sessionDate, setSessionDate] = useState(plannedDate || '');
  const [session, setSession] = useState(null);

  useEffect(() => {
    setTemplates(storage.getTemplates());
    setCoaches(storage.getCoaches());
    
    if (isEditing) {
      const existing = storage.getSession(sessionId);
      if (existing) {
        setSession(existing);
        setSelectedCoachId(existing.coachId || 'none');
      } else {
        toast.error('Session not found');
        navigate('/');
      }
    } else {
      const newSession = createSession('', null, preselectedCoachId || null, {
        observationContext: OBSERVATION_CONTEXTS.TRAINING,
        plannedDate: plannedDate || null,
        planned: !!plannedDate
      });
      // If coach is preselected, set a default name
      if (preselectedCoachId) {
        const coach = storage.getCoach(preselectedCoachId);
        if (coach) {
          newSession.name = `${coach.name} - ${new Date().toLocaleDateString()}`;
        }
      }
      setSession(newSession);
      if (plannedDate) setSessionDate(plannedDate);
    }
  }, [sessionId, isEditing, navigate, preselectedCoachId, plannedDate]);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId) || getDefaultTemplate();
    setSession(prev => ({
      ...prev,
      eventTypes: [...template.eventTypes],
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

  const updateSession = (updates) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  // Event type management
  const addEventType = () => {
    const newEvent = { id: generateId('event'), name: 'New Event', color: 'yellow' };
    updateSession({ eventTypes: [...session.eventTypes, newEvent] });
  };

  const updateEventType = (id, name) => {
    updateSession({
      eventTypes: session.eventTypes.map(e => e.id === id ? { ...e, name } : e)
    });
  };

  const removeEventType = (id) => {
    if (session.eventTypes.length <= 1) {
      toast.error('You need at least one event type');
      return;
    }
    updateSession({ eventTypes: session.eventTypes.filter(e => e.id !== id) });
  };

  // Descriptor management
  const addDescriptor = (groupNum) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey];
    const newDesc = { id: generateId('desc'), name: 'New' };
    updateSession({
      [groupKey]: { ...group, descriptors: [...group.descriptors, newDesc] }
    });
  };

  const updateDescriptor = (groupNum, id, name) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey];
    updateSession({
      [groupKey]: {
        ...group,
        descriptors: group.descriptors.map(d => d.id === id ? { ...d, name } : d)
      }
    });
  };

  const removeDescriptor = (groupNum, id) => {
    const groupKey = `descriptorGroup${groupNum}`;
    const group = session[groupKey];
    updateSession({
      [groupKey]: { ...group, descriptors: group.descriptors.filter(d => d.id !== id) }
    });
  };

  const updateGroupName = (groupNum, name) => {
    const groupKey = `descriptorGroup${groupNum}`;
    updateSession({
      [groupKey]: { ...session[groupKey], name }
    });
  };

  // Session parts management
  const addSessionPart = () => {
    const newPart = {
      id: generateId('part'),
      name: 'New Part',
      order: session.sessionParts.length,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0
    };
    updateSession({ sessionParts: [...session.sessionParts, newPart] });
  };

  const updateSessionPart = (id, name) => {
    updateSession({
      sessionParts: session.sessionParts.map(p => p.id === id ? { ...p, name } : p)
    });
  };

  const removeSessionPart = (id) => {
    if (session.sessionParts.length <= 1) {
      toast.error('You need at least one session part');
      return;
    }
    updateSession({
      sessionParts: session.sessionParts.filter(p => p.id !== id),
      activePartId: session.activePartId === id ? session.sessionParts[0].id : session.activePartId
    });
  };

  const handleSave = () => {
    if (!session.name.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    
    const updated = {
      ...session,
      updatedAt: new Date().toISOString(),
      activePartId: session.activePartId || session.sessionParts[0]?.id
    };
    
    storage.saveSession(updated);
    toast.success('Session saved');
    navigate('/');
  };

  const handleStartObservation = () => {
    if (!session.name.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    
    const updated = {
      ...session,
      updatedAt: new Date().toISOString(),
      activePartId: session.activePartId || session.sessionParts[0]?.id
    };
    
    storage.saveSession(updated);
    navigate(`/session/${session.id}/observe`);
  };

  if (!session) return null;

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
              Link this observation to a coach profile, or leave as one-off session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCoachId} onValueChange={handleCoachChange}>
              <SelectTrigger data-testid="coach-select">
                <SelectValue placeholder="Select a coach (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">One-off session (no coach linked)</SelectItem>
                {coaches.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.role && ` - ${c.role}`}</SelectItem>
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
              {session.eventTypes.map((event) => (
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
                value={session.descriptorGroup1.name}
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
              {session.descriptorGroup1.descriptors.map((desc) => (
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
                value={session.descriptorGroup2.name}
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
              {session.descriptorGroup2.descriptors.map((desc) => (
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
            <CardTitle className="font-['Manrope']">Session Parts</CardTitle>
            <Button size="sm" variant="outline" onClick={addSessionPart} data-testid="add-session-part-btn">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">Define the phases of your coaching session.</p>
            <div className="space-y-2">
              {session.sessionParts.map((part, index) => (
                <div key={part.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 w-6">{index + 1}</span>
                  <Input
                    value={part.name}
                    onChange={(e) => updateSessionPart(part.id, e.target.value)}
                    className="flex-1"
                    data-testid={`session-part-input-${part.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeSessionPart(part.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
