import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Table, Circle, Square, Edit2, Check, X, Trash2, Sparkles, Loader2, StickyNote, ChevronDown, ChevronUp, Upload, Paperclip, User, Filter, Star, ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { OBSERVATION_CONTEXTS } from '../lib/storage';
import { formatTime, formatDateTime, calcPercentage, countBy, cn, generateId } from '../lib/utils';
import { exportToPDF, exportToCSV } from '../lib/export';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { fetchReflectionTemplates, fetchReflectionTemplate } from '../lib/reflectionTemplatesApi';
import axios from 'axios';

const BACKEND_URL = ''; // Relative URL - frontend and backend on same domain
const API = '/api';
const CHART_COLORS = ['#FACC15', '#38BDF8', '#4ADE80', '#F97316', '#A855F7', '#EC4899'];

// Format relative time (milliseconds to MM:SS)
const formatRelativeTime = (ms) => {
  if (ms === undefined || ms === null) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function ReviewSession() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { user, isCoachDeveloper } = useAuth();
  const { getSession, saveSession: cloudSaveSession, setCurrentSession } = useCloudSync();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('whole'); // 'whole' or part id
  const [editingEvent, setEditingEvent] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(false);
  const [newReflection, setNewReflection] = useState('');
  const [newCoachReflection, setNewCoachReflection] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  
  // Reflection template state
  const [reflectionTemplates, setReflectionTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [templateResponses, setTemplateResponses] = useState({});
  const [savingReflection, setSavingReflection] = useState(false);
  const [observerNotesExpanded, setObserverNotesExpanded] = useState(true);
  
  const isCoachView = user?.role === 'coach';

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const loaded = await getSession(sessionId);
        if (!loaded) {
          toast.error('Session not found');
          navigate('/');
          return;
        }
        setSession(loaded);
        setCurrentSession(loaded);
        
        // Load reflection templates for coach educators
        if (!isCoachView) {
          loadReflectionTemplates();
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        toast.error('Failed to load session');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId, navigate, getSession, setCurrentSession, isCoachView]);

  // Load reflection templates
  const loadReflectionTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // First, check if session has an assigned template
      const savedTemplateId = session?.reflectionTemplateId || session?.reflection_template_id || session?.observerReflection?.templateId;
      
      if (savedTemplateId) {
        // Load the assigned template directly (works for both coach and coach educator)
        setSelectedTemplateId(savedTemplateId);
        await loadTemplateDetails(savedTemplateId);
        
        // If session already has reflection responses, load them
        if (session?.observerReflection?.responses) {
          setTemplateResponses(session.observerReflection.responses);
        }
        
        // Also load the templates list for reference (if user is coach educator)
        if (!isCoachView) {
          const templates = await fetchReflectionTemplates('coach_educator');
          setReflectionTemplates(templates);
        }
      } else {
        // No assigned template - load list and select default
        const templates = await fetchReflectionTemplates('coach_educator');
        setReflectionTemplates(templates);
        
        const defaultTemplate = templates.find(t => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.template_id);
          await loadTemplateDetails(defaultTemplate.template_id);
        }
        
        // If session already has reflection responses, load them
        if (session?.observerReflection?.responses) {
          setTemplateResponses(session.observerReflection.responses);
        }
      }
    } catch (err) {
      console.error('Failed to load reflection templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplateDetails = async (templateId) => {
    if (!templateId) return;
    try {
      const template = await fetchReflectionTemplate(templateId);
      setCurrentTemplate(template);
      
      // Initialize empty responses if not already set
      if (Object.keys(templateResponses).length === 0) {
        const initialResponses = {};
        template.questions?.forEach(q => {
          if (q.question_type === 'checkbox') {
            initialResponses[q.question_id] = [];
          } else {
            initialResponses[q.question_id] = '';
          }
        });
        setTemplateResponses(initialResponses);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    setTemplateResponses({}); // Reset responses when template changes
    loadTemplateDetails(templateId);
  };

  const handleResponseChange = (questionId, value) => {
    setTemplateResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleCheckboxChange = (questionId, option, checked) => {
    setTemplateResponses(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter(o => o !== option) };
      }
    });
  };

  const handleSaveTemplateReflection = async () => {
    if (!currentTemplate) return;
    
    // Validate required questions
    for (const q of currentTemplate.questions || []) {
      if (q.required) {
        const response = templateResponses[q.question_id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          toast.error(`Please answer: ${q.question_text}`);
          return;
        }
      }
    }

    setSavingReflection(true);
    try {
      const updated = {
        ...session,
        observerReflection: {
          templateId: currentTemplate.template_id,
          templateName: currentTemplate.name,
          responses: templateResponses,
          completedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };
      
      await saveSession(updated);
      toast.success('Reflection saved!');
    } catch (err) {
      toast.error('Failed to save reflection');
    } finally {
      setSavingReflection(false);
    }
  };

  const saveSession = async (updated) => {
    setSession(updated);
    setCurrentSession(updated);
    await cloudSaveSession(updated);
  };

  const getFilteredEvents = () => {
    if (!session) return [];
    if (viewMode === 'whole') return session.events || [];
    return (session.events || []).filter(e => e.sessionPartId === viewMode);
  };

  // Get unique session parts used in this session
  const getSessionParts = () => {
    if (!session) return [];
    return session.sessionParts || [];
  };

  // Get session parts that actually have data (events, ball rolling time, or ball stopped time)
  const getActiveSessionParts = () => {
    if (!session) return [];
    const parts = session.sessionParts || [];
    const events = session.events || [];
    
    return parts.filter(part => {
      // Check if part has any events
      const hasEvents = events.some(e => e.sessionPartId === part.id);
      // Check if part has ball rolling or stopped time
      const hasBallTime = (part.ballRollingTime || 0) > 0 || (part.ballNotRollingTime || 0) > 0;
      return hasEvents || hasBallTime;
    });
  };

  const getStats = () => {
    const events = getFilteredEvents();
    const eventCounts = countBy(events, 'eventTypeId');
    
    // Calculate descriptor counts (with defensive checks)
    const desc1Counts = {};
    const desc2Counts = {};
    events.forEach(e => {
      if (Array.isArray(e.descriptors1)) {
        e.descriptors1.forEach(d => {
          desc1Counts[d] = (desc1Counts[d] || 0) + 1;
        });
      }
      if (Array.isArray(e.descriptors2)) {
        e.descriptors2.forEach(d => {
          desc2Counts[d] = (desc2Counts[d] || 0) + 1;
        });
      }
    });
    
    // Ball rolling stats
    let ballRollingTime, ballNotRollingTime, totalTime;
    if (viewMode === 'whole') {
      ballRollingTime = session.ballRollingTime || 0;
      ballNotRollingTime = session.ballNotRollingTime || 0;
      totalTime = session.totalDuration || 0;
    } else {
      const part = (session.sessionParts || []).find(p => p.id === viewMode);
      ballRollingTime = part?.ballRollingTime || 0;
      ballNotRollingTime = part?.ballNotRollingTime || 0;
      totalTime = ballRollingTime + ballNotRollingTime;
    }
    
    const ballRollingPct = calcPercentage(ballRollingTime, totalTime);
    
    return {
      eventCounts,
      desc1Counts,
      desc2Counts,
      ballRollingTime,
      ballNotRollingTime,
      ballRollingPct,
      totalTime,
      totalEvents: events.length
    };
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event.id);
    setEditNote(event.note || '');
  };

  const handleSaveEdit = (eventId) => {
    const updated = {
      ...session,
      events: (session.events || []).map(e => 
        e.id === eventId ? { ...e, note: editNote } : e
      )
    };
    saveSession(updated);
    setEditingEvent(null);
    setEditNote('');
    toast.success('Intervention updated');
  };

  const handleDeleteEvent = (eventId) => {
    const updated = {
      ...session,
      events: (session.events || []).filter(e => e.id !== eventId)
    };
    saveSession(updated);
    toast.success('Intervention deleted');
  };

  const handleAddReflection = (type) => {
    const text = type === 'observer' ? newReflection : newCoachReflection;
    if (!text.trim()) return;
    
    const reflection = {
      id: generateId('reflection'),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      author: type
    };
    
    const key = type === 'observer' ? 'observerReflections' : 'coachReflections';
    const updated = {
      ...session,
      [key]: [...(session[key] || []), reflection]
    };
    saveSession(updated);
    
    if (type === 'observer') {
      setNewReflection('');
    } else {
      setNewCoachReflection('');
    }
    toast.success('Reflection added');
  };

  const handleDeleteReflection = (type, reflectionId) => {
    const key = type === 'observer' ? 'observerReflections' : 'coachReflections';
    const updated = {
      ...session,
      [key]: (session[key] || []).filter(r => r.id !== reflectionId)
    };
    saveSession(updated);
    toast.success('Reflection removed');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const attachment = response.data;
      const updated = {
        ...session,
        attachments: [...(session.attachments || []), attachment]
      };
      saveSession(updated);
      toast.success('File uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await axios.delete(`${API}/files/${attachmentId}`);
    } catch (err) {
      console.warn('File may already be deleted');
    }
    
    const updated = {
      ...session,
      attachments: (session.attachments || []).filter(a => a.id !== attachmentId)
    };
    saveSession(updated);
    toast.success('Attachment removed');
  };

  const handleGenerateSummary = async () => {
    if ((session.events || []).length === 0) {
      toast.error('No interventions to summarize');
      return;
    }
    
    setIsGeneratingSummary(true);
    try {
      const stats = getStats();
      
      // Fetch coach targets if session has a coach
      let coachTargets = null;
      if (session.coachId) {
        try {
          const coachResponse = await axios.get(`${API}/coaches/${session.coachId}`);
          const targets = coachResponse.data?.targets || [];
          coachTargets = targets
            .filter(t => t.status === 'active')
            .map(t => t.text);
        } catch (err) {
          console.warn('Could not fetch coach targets:', err);
        }
      }
      
      // Prepare intervention breakdown
      const interventionTypes = session.interventionTypes || session.eventTypes || [];
      const eventBreakdown = {};
      interventionTypes.forEach(et => {
        eventBreakdown[et.name] = stats.eventCounts[et.id] || 0;
      });
      
      // Prepare descriptor breakdowns
      const desc1Breakdown = {};
      if (session.descriptorGroup1?.descriptors) {
        session.descriptorGroup1.descriptors.forEach(d => {
          desc1Breakdown[d.name] = stats.desc1Counts[d.id] || 0;
        });
      }
      
      const desc2Breakdown = {};
      if (session.descriptorGroup2?.descriptors) {
        session.descriptorGroup2.descriptors.forEach(d => {
          desc2Breakdown[d.name] = stats.desc2Counts[d.id] || 0;
        });
      }
      
      // Prepare session parts
      const sessionPartsData = (session.sessionParts || []).map(part => {
        const partEvents = (session.events || []).filter(e => e.sessionPartId === part.id);
        const partTotal = (part.ballRollingTime || 0) + (part.ballNotRollingTime || 0);
        return {
          name: part.name,
          events: partEvents.length,
          ballRollingPct: calcPercentage(part.ballRollingTime, partTotal)
        };
      });
      
      const response = await axios.post(`${API}/generate-summary`, {
        session_name: session.name,
        total_duration: session.totalDuration,
        total_events: (session.events || []).length,
        ball_rolling_time: Math.round(session.ballRollingTime || 0),
        ball_not_rolling_time: Math.round(session.ballNotRollingTime || 0),
        event_breakdown: eventBreakdown,
        descriptor1_name: session.descriptorGroup1?.name || 'Descriptor 1',
        descriptor1_breakdown: desc1Breakdown,
        descriptor2_name: session.descriptorGroup2?.name || 'Descriptor 2',
        descriptor2_breakdown: desc2Breakdown,
        session_parts: sessionPartsData,
        user_notes: (session.observerReflections || []).map(r => r.text).join('\n'),
        observation_context: session.observationContext || 'training',
        // Coach context - use session data and fetched targets
        coach_name: session.coachName || null,
        coach_targets: coachTargets,
        previous_sessions_summary: null
      });
      
      const updated = {
        ...session,
        aiSummary: response.data.summary
      };
      saveSession(updated);
      setAiSummaryExpanded(true);
      toast.success('Summary generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleEditSummary = () => {
    setEditedSummary(session.aiSummary || '');
    setIsEditingSummary(true);
  };

  const handleSaveSummary = () => {
    const updated = {
      ...session,
      aiSummary: editedSummary
    };
    saveSession(updated);
    setIsEditingSummary(false);
    toast.success('Summary updated');
  };

  const handleCancelEditSummary = () => {
    setIsEditingSummary(false);
    setEditedSummary('');
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(session);
      toast.success('PDF exported');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(session);
      toast.success('CSV exported');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = getStats();
  const events = getFilteredEvents();

  // Get intervention/event types (handle both naming conventions)
  const interventionTypesList = session.interventionTypes || session.eventTypes || [];

  // Prepare chart data
  const eventChartData = interventionTypesList.map(et => ({
    name: et.name,
    count: stats.eventCounts[et.id] || 0
  }));

  const ballRollingData = [
    { name: 'Ball Rolling', value: stats.ballRollingTime, color: '#F97316' },
    { name: 'Ball Stopped', value: stats.ballNotRollingTime, color: '#64748B' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">{session.name}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{formatDateTime(session.createdAt)}</span>
                {session.coachName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {session.coachName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} data-testid="export-csv-btn">
              <Table className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button onClick={handleExportPDF} data-testid="export-pdf-btn">
              <FileText className="w-4 h-4 mr-2" />
              PDF Report
            </Button>
          </div>
        </div>
      </header>

      {/* View Toggle - Only show parts that have data */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setViewMode('whole')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'whole'
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              data-testid="view-whole-btn"
            >
              Whole Session
            </button>
            {getActiveSessionParts().map((part) => (
              <button
                key={part.id}
                onClick={() => setViewMode(part.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  viewMode === part.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                data-testid={`view-part-${part.id}`}
              >
                {part.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
            <TabsTrigger value="reflections" data-testid="tab-reflections">Reflections</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {/* Session Summary Display */}
            {session.aiSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Session Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate prose-sm max-w-none">
                    {session.aiSummary.split('\n').map((paragraph, i) => (
                      <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold font-mono text-slate-900" data-testid="total-duration">
                    {formatTime(stats.totalTime)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Total Duration</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-slate-900" data-testid="total-events">
                    {stats.totalEvents}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Total Events</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Circle className="w-5 h-5 text-orange-500 fill-current" />
                    <span className="text-3xl font-bold text-slate-900" data-testid="ball-rolling-pct">
                      {stats.ballRollingPct}%
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Ball Rolling</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Square className="w-5 h-5 text-slate-500" />
                    <span className="text-3xl font-bold text-slate-900">
                      {100 - stats.ballRollingPct}%
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Ball Stopped</div>
                </CardContent>
              </Card>
            </div>

            {/* Ball Rolling Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-['Manrope']">Ball Rolling Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600 font-medium">
                      Rolling: {formatTime(stats.ballRollingTime)}
                    </span>
                    <span className="text-slate-500">
                      Stopped: {formatTime(stats.ballNotRollingTime)}
                    </span>
                  </div>
                  <Progress value={stats.ballRollingPct} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Intervention Breakdown - renamed from Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-['Manrope']">Coach Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(session.interventionTypes || session.eventTypes || []).map((et) => {
                    const count = stats.eventCounts[et.id] || 0;
                    const pct = calcPercentage(count, stats.totalEvents);
                    return (
                      <div key={et.id} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded bg-yellow-400" />
                        <span className="flex-1 font-medium text-slate-700">{et.name}</span>
                        <span className="text-slate-900 font-semibold">{count}</span>
                        <Badge variant="secondary">{pct}%</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Descriptor Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              {session.descriptorGroup1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-sky-400" />
                    {session.descriptorGroup1.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(session.descriptorGroup1.descriptors || []).map((desc) => {
                      const count = stats.desc1Counts[desc.id] || 0;
                      return (
                        <div key={desc.id} className="flex items-center justify-between">
                          <span className="text-slate-600">{desc.name}</span>
                          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              {session.descriptorGroup2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-400" />
                    {session.descriptorGroup2.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(session.descriptorGroup2.descriptors || []).map((desc) => {
                      const count = stats.desc2Counts[desc.id] || 0;
                      return (
                        <div key={desc.id} className="flex items-center justify-between">
                          <span className="text-slate-600">{desc.name}</span>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </TabsContent>

          {/* Reflections Tab - Restructured */}
          <TabsContent value="reflections" className="space-y-6">
            {/* Observer Notes Card - Collapsible */}
            {!isCoachView && (session.observerNotes || []).length > 0 && (
              <Collapsible open={observerNotesExpanded} onOpenChange={setObserverNotesExpanded}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-['Manrope'] flex items-center gap-2">
                          <StickyNote className="w-5 h-5 text-purple-600" />
                          Observer Notes
                          <Badge variant="secondary" className="ml-2">
                            {session.observerNotes.length}
                          </Badge>
                        </CardTitle>
                        {observerNotesExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <CardDescription>
                        Private notes taken during the observation session.
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      {session.observerNotes.map(note => {
                        const part = (session.sessionParts || []).find(p => p.id === note.partId);
                        return (
                          <div key={note.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <p className="text-slate-700">{note.text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <span>{formatDateTime(note.timestamp)}</span>
                              {part && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">{part.name}</Badge>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Observer Reflection Template Form */}
            {!isCoachView && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Observer Reflection
                  </CardTitle>
                  <CardDescription>
                    Complete your structured reflection using a template.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Selector */}
                  <div className="space-y-2">
                    <Label>Reflection Template</Label>
                    <Select 
                      value={selectedTemplateId} 
                      onValueChange={handleTemplateChange}
                      disabled={loadingTemplates}
                    >
                      <SelectTrigger data-testid="reflection-template-select">
                        <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {reflectionTemplates.map(t => (
                          <SelectItem key={t.template_id} value={t.template_id}>
                            {t.name} {t.is_default && <span className="text-blue-600">(Default)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {reflectionTemplates.length === 0 && !loadingTemplates && (
                      <p className="text-sm text-slate-500">
                        No reflection templates available. Create one in Templates.
                      </p>
                    )}
                  </div>

                  {/* Template Questions */}
                  {currentTemplate && (
                    <div className="space-y-6 mt-4 pt-4 border-t">
                      {currentTemplate.questions?.map((question, qIndex) => (
                        <div key={question.question_id} className="space-y-2">
                          <Label className="flex items-center gap-1">
                            {question.question_text}
                            {question.required && <span className="text-red-500">*</span>}
                          </Label>

                          {/* Text Input */}
                          {question.question_type === 'text' && (
                            <Textarea
                              value={templateResponses[question.question_id] || ''}
                              onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
                              placeholder="Enter your response..."
                              className="min-h-[100px]"
                              data-testid={`reflection-q-${qIndex}`}
                            />
                          )}

                          {/* Scale Input */}
                          {question.question_type === 'scale' && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>{question.scale_min_label || question.scale_min}</span>
                                <span>{question.scale_max_label || question.scale_max}</span>
                              </div>
                              <div className="flex gap-2">
                                {Array.from(
                                  { length: (question.scale_max || 5) - (question.scale_min || 1) + 1 },
                                  (_, i) => (question.scale_min || 1) + i
                                ).map(value => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleResponseChange(question.question_id, value)}
                                    className={cn(
                                      "w-10 h-10 rounded-lg font-medium transition-all",
                                      templateResponses[question.question_id] === value
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                    data-testid={`reflection-q-${qIndex}-scale-${value}`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dropdown Input */}
                          {question.question_type === 'dropdown' && (
                            <Select
                              value={templateResponses[question.question_id] || ''}
                              onValueChange={(value) => handleResponseChange(question.question_id, value)}
                            >
                              <SelectTrigger data-testid={`reflection-q-${qIndex}`}>
                                <SelectValue placeholder="Select an option" />
                              </SelectTrigger>
                              <SelectContent>
                                {(question.options || []).map((option, oIndex) => (
                                  <SelectItem key={oIndex} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Checkbox Input */}
                          {question.question_type === 'checkbox' && (
                            <div className="space-y-2">
                              {(question.options || []).map((option, oIndex) => (
                                <div key={oIndex} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${question.question_id}-${oIndex}`}
                                    checked={(templateResponses[question.question_id] || []).includes(option)}
                                    onCheckedChange={(checked) => handleCheckboxChange(question.question_id, option, checked)}
                                    data-testid={`reflection-q-${qIndex}-cb-${oIndex}`}
                                  />
                                  <Label htmlFor={`${question.question_id}-${oIndex}`} className="font-normal">
                                    {option}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Save Button */}
                      <div className="pt-4">
                        <Button 
                          onClick={handleSaveTemplateReflection}
                          disabled={savingReflection}
                          className="w-full sm:w-auto"
                          data-testid="save-reflection-btn"
                        >
                          {savingReflection ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Save Reflection
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Show saved reflection if exists */}
                  {session.observerReflection?.completedAt && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">Reflection completed</span>
                        <span className="text-sm text-green-600">
                          {formatDateTime(session.observerReflection.completedAt)}
                        </span>
                      </div>
                      {session.observerReflection.templateName && (
                        <p className="text-sm text-slate-600">
                          Template: {session.observerReflection.templateName}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Free-form Observer Reflections */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Additional Notes
                </CardTitle>
                <CardDescription>
                  Add free-form observations and notes about this session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing reflections */}
                {(session.observerReflections || []).length > 0 && (
                  <div className="space-y-3 mb-4">
                    {session.observerReflections.map(r => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-700">{r.text}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatDateTime(r.timestamp)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteReflection('observer', r.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new reflection */}
                <div className="flex gap-2">
                  <Textarea
                    value={newReflection}
                    onChange={(e) => setNewReflection(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[80px] resize-y flex-1"
                    data-testid="observer-reflection-textarea"
                  />
                </div>
                <Button 
                  onClick={() => handleAddReflection('observer')} 
                  variant="outline" 
                  disabled={!newReflection.trim()}
                  data-testid="add-observer-reflection-btn"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {/* Coach Reflections */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  Coach Reflections
                </CardTitle>
                <CardDescription>
                  {isCoachView ? 'Add your reflections on this session.' : 'Reflections from the coach.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(session.coachReflections || []).length > 0 ? (
                  <div className="space-y-3">
                    {session.coachReflections.map(r => (
                      <div key={r.id} className="p-4 bg-green-50 rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            {/* Self Rating */}
                            {r.rating && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Self Assessment</p>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <div 
                                      key={n}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                                        n <= r.rating 
                                          ? 'bg-blue-500 text-white' 
                                          : 'bg-slate-200 text-slate-400'
                                      }`}
                                    >
                                      {n}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Main Reflection */}
                            {r.text && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Reflection</p>
                                <p className="text-slate-700">{r.text}</p>
                              </div>
                            )}
                            
                            {/* What Went Well */}
                            {r.what_went_well && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">What went well</p>
                                <p className="text-slate-700">{r.what_went_well}</p>
                              </div>
                            )}
                            
                            {/* Areas for Development */}
                            {r.areas_for_development && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Areas for development</p>
                                <p className="text-slate-700">{r.areas_for_development}</p>
                              </div>
                            )}
                            
                            <p className="text-xs text-slate-400 mt-2">{formatDateTime(r.timestamp)}</p>
                          </div>
                          {isCoachView && !r.source && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-slate-400 hover:text-red-600"
                              onClick={() => handleDeleteReflection('coach', r.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-sm">No coach reflections yet</p>
                )}
                
                {/* Coach can add reflections */}
                {isCoachView && (
                  <>
                    <Textarea
                      value={newCoachReflection}
                      onChange={(e) => setNewCoachReflection(e.target.value)}
                      placeholder="Add your reflection..."
                      className="min-h-[80px] resize-y"
                      data-testid="coach-reflection-textarea"
                    />
                    <Button 
                      onClick={() => handleAddReflection('coach')} 
                      variant="outline"
                      disabled={!newCoachReflection.trim()}
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Add Reflection
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments
                </CardTitle>
                <CardDescription>
                  Session plans, supporting documents, and other files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(session.attachments || []).length > 0 && (
                  <div className="space-y-2">
                    {session.attachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <a 
                          href={`${BACKEND_URL}${a.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          {a.name}
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteAttachment(a.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload File
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Summary - Collapsible */}
            <Collapsible open={aiSummaryExpanded} onOpenChange={setAiSummaryExpanded}>
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => setAiSummaryExpanded(!aiSummaryExpanded)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      AI Summary
                      {session.aiSummary && (
                        <Badge variant="secondary" className="ml-2">Generated</Badge>
                      )}
                    </CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon">
                        {aiSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CardDescription>
                    AI-powered analysis based on observation data and reflections.
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingSummary || (session.events || []).length === 0}
                        variant="default"
                        data-testid="generate-summary-btn"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {session.aiSummary ? 'Regenerate' : 'Generate Summary'}
                          </>
                        )}
                      </Button>
                      {session.aiSummary && !isEditingSummary && (
                        <Button 
                          onClick={handleEditSummary}
                          variant="outline"
                          data-testid="edit-summary-btn"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                    
                    {session.aiSummary && (
                      <div className="p-4 bg-slate-50 rounded-lg">
                        {isEditingSummary ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editedSummary}
                              onChange={(e) => setEditedSummary(e.target.value)}
                              className="min-h-[200px] font-normal"
                              placeholder="Edit the session summary..."
                            />
                            <div className="flex gap-2">
                              <Button onClick={handleSaveSummary} size="sm">
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button onClick={handleCancelEditSummary} variant="outline" size="sm">
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-slate prose-sm max-w-none">
                            {session.aiSummary.split('\n').map((paragraph, i) => (
                              paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>

          {/* Session Activity Tab - Density Visualization */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Session Activity Density</CardTitle>
                <CardDescription>Visual representation of when interventions occurred during the session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No events recorded in this session
                  </div>
                ) : (
                  <>
                    {/* Session Density Visualization */}
                    <div className="space-y-4">
                      {/* Main density bar */}
                      <div className="relative">
                        <div className="text-sm font-medium text-slate-700 mb-2">Intervention Timeline</div>
                        
                        {/* Time axis labels */}
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>00:00</span>
                          <span>{formatRelativeTime(session.totalDuration || Math.max(...events.map(e => e.relativeTimestamp || 0)))}</span>
                        </div>
                        
                        {/* Density bar container */}
                        <div 
                          className="relative h-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200"
                          data-testid="density-bar"
                        >
                          {/* Ball rolling segments background */}
                          {(session.ballRollingLog || []).map((segment, idx) => {
                            const totalDuration = session.totalDuration || 1;
                            const startPct = ((segment.start || 0) / totalDuration) * 100;
                            const widthPct = ((segment.duration || 0) / totalDuration) * 100;
                            return (
                              <div
                                key={`ball-${idx}`}
                                className={cn(
                                  "absolute top-0 h-full opacity-20",
                                  segment.rolling ? "bg-green-400" : "bg-red-300"
                                )}
                                style={{
                                  left: `${startPct}%`,
                                  width: `${widthPct}%`
                                }}
                              />
                            );
                          })}
                          
                          {/* Event markers */}
                          {events.map((event, index) => {
                            const totalDuration = session.totalDuration || Math.max(...events.map(e => e.relativeTimestamp || 0)) || 1;
                            const position = ((event.relativeTimestamp || 0) / totalDuration) * 100;
                            
                            // Color based on event type
                            const eventTypeIndex = (session.interventionTypes || []).findIndex(t => t.id === event.eventTypeId);
                            const color = CHART_COLORS[eventTypeIndex % CHART_COLORS.length] || '#FACC15';
                            
                            return (
                              <div
                                key={event.id}
                                className="absolute top-0 h-full group cursor-pointer"
                                style={{
                                  left: `${Math.min(position, 98)}%`,
                                  width: '2px'
                                }}
                                data-testid={`density-marker-${event.id}`}
                              >
                                <div 
                                  className="w-full h-full transition-all group-hover:w-2"
                                  style={{ backgroundColor: color }}
                                />
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                    <div className="font-medium">{event.eventTypeName}</div>
                                    <div className="text-slate-300">{formatRelativeTime(event.relativeTimestamp)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mt-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-green-400 rounded opacity-40" />
                            <span className="text-slate-600">Ball Rolling</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-red-300 rounded opacity-40" />
                            <span className="text-slate-600">Ball Stopped</span>
                          </div>
                          <span className="text-slate-400">|</span>
                          {(session.interventionTypes || []).slice(0, 5).map((type, idx) => (
                            <div key={type.id} className="flex items-center gap-1.5">
                              <div 
                                className="w-3 h-3 rounded" 
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              <span className="text-slate-600">{type.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Density summary stats */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-900">{events.length}</div>
                          <div className="text-xs text-slate-500">Total Interventions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-900">
                            {(() => {
                              // Calculate average gap between interventions
                              if (events.length < 2) return '--';
                              const sortedEvents = [...events].sort((a, b) => (a.relativeTimestamp || 0) - (b.relativeTimestamp || 0));
                              let totalGap = 0;
                              for (let i = 1; i < sortedEvents.length; i++) {
                                totalGap += (sortedEvents[i].relativeTimestamp || 0) - (sortedEvents[i-1].relativeTimestamp || 0);
                              }
                              return formatRelativeTime(totalGap / (sortedEvents.length - 1));
                            })()}
                          </div>
                          <div className="text-xs text-slate-500">Avg Gap Between</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-900">
                            {(() => {
                              // Find busiest minute
                              if (events.length === 0) return '--';
                              const minuteBuckets = {};
                              events.forEach(e => {
                                const minute = Math.floor((e.relativeTimestamp || 0) / 60000);
                                minuteBuckets[minute] = (minuteBuckets[minute] || 0) + 1;
                              });
                              return Math.max(...Object.values(minuteBuckets));
                            })()}
                          </div>
                          <div className="text-xs text-slate-500">Peak Per Minute</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Event List - Condensed */}
                    <div className="pt-4 border-t">
                      <div className="text-sm font-medium text-slate-700 mb-3">Event Details</div>
                      <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-2">
                          {events.map((event, index) => {
                            const part = (session.sessionParts || []).find(p => p.id === event.sessionPartId);
                            const eventTypeIndex = (session.interventionTypes || []).findIndex(t => t.id === event.eventTypeId);
                            const color = CHART_COLORS[eventTypeIndex % CHART_COLORS.length] || '#FACC15';
                            
                            return (
                              <div 
                                key={event.id} 
                                className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                                data-testid={`event-row-${event.id}`}
                              >
                                <div 
                                  className="w-1 h-10 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-900 text-sm">{event.eventTypeName}</span>
                                    <span className="text-xs text-slate-500 font-mono">
                                      {formatRelativeTime(event.relativeTimestamp)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {part && (
                                      <Badge variant="outline" className="text-xs py-0">
                                        {part.name}
                                      </Badge>
                                    )}
                                    {(event.descriptors1 || []).slice(0, 2).map(d => {
                                      const desc = session.descriptorGroup1?.descriptors?.find(x => x.id === d);
                                      return desc && (
                                        <Badge key={d} className="bg-sky-100 text-sky-800 hover:bg-sky-100 text-xs py-0">
                                          {desc.name}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleEditEvent(event)}
                                    data-testid={`edit-event-${event.id}`}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently remove this event from the session.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteEvent(event.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-6">
            {/* Events Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Events Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#FACC15" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Ball Rolling Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Ball Rolling vs Stopped</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ballRollingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {ballRollingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatTime(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Descriptor Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              {session.descriptorGroup1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope']">{session.descriptorGroup1.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={(session.descriptorGroup1.descriptors || []).map(d => ({
                          name: d.name,
                          count: stats.desc1Counts[d.id] || 0
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              )}

              {session.descriptorGroup2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope']">{session.descriptorGroup2.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={(session.descriptorGroup2.descriptors || []).map(d => ({
                          name: d.name,
                          count: stats.desc2Counts[d.id] || 0
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#4ADE80" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
