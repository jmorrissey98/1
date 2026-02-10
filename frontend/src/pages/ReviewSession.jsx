import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Table, Circle, Square, Edit2, Check, X, Trash2, Sparkles, Loader2, StickyNote, ChevronDown, ChevronUp, Upload, Paperclip, User, Filter } from 'lucide-react';
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
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { OBSERVATION_CONTEXTS } from '../lib/storage';
import { formatTime, formatDateTime, calcPercentage, countBy, cn, generateId } from '../lib/utils';
import { exportToPDF, exportToCSV } from '../lib/export';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import axios from 'axios';

const BACKEND_URL = ''; // Relative URL - frontend and backend on same domain
const API = '/api';
const CHART_COLORS = ['#FACC15', '#38BDF8', '#4ADE80', '#F97316', '#A855F7', '#EC4899'];

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
      } catch (err) {
        console.error('Failed to load session:', err);
        toast.error('Failed to load session');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId, navigate, getSession, setCurrentSession]);

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

  const getPreviousSessionsSummary = () => {
    if (!session.coachId) return null;
    
    const previousSessions = storage.getCoachSessions(session.coachId)
      .filter(s => s.id !== session.id && s.status === 'completed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3); // Last 3 sessions
    
    if (previousSessions.length === 0) return null;
    
    return previousSessions.map(s => {
      const brPct = calcPercentage(s.ballRollingTime, s.ballRollingTime + s.ballNotRollingTime);
      return `${s.name} (${formatDateTime(s.createdAt)}): ${s.events?.length || 0} events, ${brPct}% ball rolling`;
    }).join('; ');
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
      events: session.events.map(e => 
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
      events: session.events.filter(e => e.id !== eventId)
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
    if (session.events.length === 0) {
      toast.error('No interventions to summarize');
      return;
    }
    
    setIsGeneratingSummary(true);
    try {
      const stats = getStats();
      
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
        // Coach context if linked
        coach_name: session.coachId ? storage.getCoach(session.coachId)?.name : null,
        coach_targets: session.coachId ? (storage.getCoach(session.coachId)?.targets || []).filter(t => t.status === 'active').map(t => t.text) : null,
        previous_sessions_summary: session.coachId ? getPreviousSessionsSummary() : null
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

  // Prepare chart data
  const eventChartData = session.eventTypes.map(et => ({
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
              <p className="text-sm text-slate-500">{formatDateTime(session.createdAt)}</p>
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

      {/* View Toggle */}
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
            {session.sessionParts.map((part) => (
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
            <TabsTrigger value="notes" data-testid="tab-notes">Notes & AI</TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {/* AI Summary Display */}
            {session.aiSummary && (
              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    AI Session Summary
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

          {/* Reflections & AI Tab - Updated */}
          <TabsContent value="notes" className="space-y-6">
            {/* Observer Reflections */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Observer Reflections
                </CardTitle>
                <CardDescription>
                  Add your observations and reflections on this session.
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
                    placeholder="Add a reflection..."
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
                  Add Reflection
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
                      <div key={r.id} className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-700">{r.text}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatDateTime(r.timestamp)}</p>
                          </div>
                          {isCoachView && (
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

            {/* AI Summary - Collapsible by default */}
            <Collapsible open={aiSummaryExpanded} onOpenChange={setAiSummaryExpanded}>
              <Card className="border-purple-200">
                <CardHeader className="cursor-pointer" onClick={() => setAiSummaryExpanded(!aiSummaryExpanded)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-['Manrope'] flex items-center gap-2 text-purple-900">
                      <Sparkles className="w-5 h-5" />
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
                    <Button 
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary || session.events.length === 0}
                      className="bg-purple-600 hover:bg-purple-700"
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
                          {session.aiSummary ? 'Regenerate Summary' : 'Generate Summary'}
                        </>
                      )}
                    </Button>
                    
                    {session.aiSummary && (
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="prose prose-slate prose-sm max-w-none">
                          {session.aiSummary.split('\n').map((paragraph, i) => (
                            paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Event Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No events recorded in this view
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {events.map((event, index) => {
                        const part = session.sessionParts.find(p => p.id === event.sessionPartId);
                        const isEditing = editingEvent === event.id;
                        
                        return (
                          <div 
                            key={event.id} 
                            className="flex gap-4 p-3 bg-slate-50 rounded-lg group"
                            data-testid={`event-row-${event.id}`}
                          >
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded bg-yellow-400" />
                              {index < events.length - 1 && (
                                <div className="w-0.5 h-full bg-slate-200 mt-1" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-semibold text-slate-900">{event.eventTypeName}</span>
                                  <span className="text-sm text-slate-500 ml-2">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                  </span>
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
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {part?.name || 'Unknown Part'}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    event.ballRolling ? "border-orange-300 text-orange-600" : "border-slate-300 text-slate-500"
                                  )}
                                >
                                  {event.ballRolling ? 'Ball Rolling' : 'Ball Stopped'}
                                </Badge>
                                {event.descriptors1.map(d => {
                                  const desc = session.descriptorGroup1.descriptors.find(x => x.id === d);
                                  return desc && (
                                    <Badge key={d} className="bg-sky-100 text-sky-800 hover:bg-sky-100 text-xs">
                                      {desc.name}
                                    </Badge>
                                  );
                                })}
                                {event.descriptors2.map(d => {
                                  const desc = session.descriptorGroup2.descriptors.find(x => x.id === d);
                                  return desc && (
                                    <Badge key={d} className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                                      {desc.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <Input
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="Add note..."
                                    className="flex-1 h-8 text-sm"
                                    data-testid={`edit-note-input-${event.id}`}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleSaveEdit(event.id)}
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => setEditingEvent(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : event.note && (
                                <p className="text-sm text-slate-600 mt-1 italic">"{event.note}"</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
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
