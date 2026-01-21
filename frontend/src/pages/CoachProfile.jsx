import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Check, X, Target, Calendar, User, Sparkles, Loader2, Eye, Play, Download, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { storage } from '../lib/storage';
import { formatDate, formatTime, generateId, calcPercentage, countBy } from '../lib/utils';
import { exportCoachReportPDF, exportCoachReportCSV } from '../lib/export';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CoachProfile() {
  const navigate = useNavigate();
  const { coachId } = useParams();
  
  const [coach, setCoach] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [isGeneratingTrends, setIsGeneratingTrends] = useState(false);
  
  // Report export state
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadCoach();
  }, [coachId]);

  const loadCoach = () => {
    const loaded = storage.getCoach(coachId);
    if (!loaded) {
      toast.error('Coach not found');
      navigate('/coaches');
      return;
    }
    setCoach(loaded);
    setEditName(loaded.name);
    setEditRole(loaded.role || '');
    setEditNotes(loaded.notes || '');
    
    // Load sessions for this coach
    const coachSessions = storage.getCoachSessions(coachId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setSessions(coachSessions);
  };

  const saveCoach = (updated) => {
    storage.saveCoach({ ...updated, updatedAt: new Date().toISOString() });
    setCoach(updated);
  };

  const handleSaveDetails = () => {
    const updated = {
      ...coach,
      name: editName,
      role: editRole,
      notes: editNotes
    };
    saveCoach(updated);
    setIsEditing(false);
    toast.success('Profile updated');
  };

  const handleAddTarget = () => {
    if (!newTarget.trim()) return;
    
    const target = {
      id: generateId('target'),
      text: newTarget.trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    const updated = {
      ...coach,
      targets: [...(coach.targets || []), target]
    };
    saveCoach(updated);
    setNewTarget('');
    toast.success('Target added');
  };

  const handleToggleTarget = (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.map(t => 
        t.id === targetId 
          ? { ...t, status: t.status === 'active' ? 'achieved' : 'active' }
          : t
      )
    };
    saveCoach(updated);
  };

  const handleDeleteTarget = (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.filter(t => t.id !== targetId)
    };
    saveCoach(updated);
    toast.success('Target removed');
  };

  const handleGenerateTrends = async () => {
    if (sessions.length === 0) {
      toast.error('No sessions to analyze');
      return;
    }
    
    setIsGeneratingTrends(true);
    try {
      const sessionsData = sessions.map(s => ({
        name: s.name,
        date: formatDate(s.createdAt),
        duration: formatTime(s.totalDuration),
        events: s.events?.length || 0,
        ballRollingPct: Math.round((s.ballRollingTime / (s.ballRollingTime + s.ballNotRollingTime || 1)) * 100),
        interventions: s.eventTypes?.map(et => {
          const count = s.events?.filter(e => e.eventTypeId === et.id).length || 0;
          return `${et.name}: ${count}`;
        }).join(', ')
      }));
      
      const response = await axios.post(`${API}/generate-coach-trends`, {
        coach_name: coach.name,
        sessions_data: sessionsData,
        current_targets: (coach.targets || []).filter(t => t.status === 'active').map(t => t.text)
      });
      
      const updated = {
        ...coach,
        aiTrendSummary: response.data.trend_summary,
        aiTrendSummaryDate: new Date().toISOString()
      };
      saveCoach(updated);
      toast.success('Trends analysis generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate trends');
    } finally {
      setIsGeneratingTrends(false);
    }
  };

  const handleExportReport = async (format) => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999); // Include full end date
    
    if (start > end) {
      toast.error('Start date must be before end date');
      return;
    }
    
    // Filter sessions within date range
    const filteredSessions = sessions.filter(s => {
      const sessionDate = new Date(s.createdAt);
      return sessionDate >= start && sessionDate <= end && s.status === 'completed';
    });
    
    if (filteredSessions.length === 0) {
      toast.error('No completed sessions found in selected date range');
      return;
    }
    
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportCoachReportPDF(coach, filteredSessions, reportStartDate, reportEndDate);
      } else {
        exportCoachReportCSV(coach, filteredSessions, reportStartDate, reportEndDate);
      }
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteCoach = () => {
    storage.deleteCoach(coachId);
    toast.success('Coach profile deleted');
    navigate('/coaches');
  };

  if (!coach) return null;

  const activeTargets = (coach.targets || []).filter(t => t.status === 'active');
  const achievedTargets = (coach.targets || []).filter(t => t.status === 'achieved');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/coaches')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">{coach.name}</h1>
                {coach.role && <p className="text-sm text-slate-500">{coach.role}</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate(`/session/new?coachId=${coachId}`)}
              data-testid="new-observation-btn"
            >
              <Play className="w-4 h-4 mr-2" />
              New Observation
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Coach Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete {coach.name}'s profile. Session data will be preserved but unlinked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCoach} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="targets" data-testid="tab-targets">Targets</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-slate-900">{sessions.length}</div>
                  <div className="text-sm text-slate-500">Sessions Observed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-orange-600">{activeTargets.length}</div>
                  <div className="text-sm text-slate-500">Active Targets</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{achievedTargets.length}</div>
                  <div className="text-sm text-slate-500">Targets Achieved</div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-['Manrope']">Profile Details</CardTitle>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Role</label>
                      <Input
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        placeholder="e.g., U14 Head Coach"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Notes</label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="General notes about this coach..."
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveDetails}>Save</Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coach.role && (
                      <div>
                        <span className="text-sm text-slate-500">Role: </span>
                        <span className="text-slate-900">{coach.role}</span>
                      </div>
                    )}
                    {coach.notes && (
                      <div>
                        <span className="text-sm text-slate-500">Notes: </span>
                        <p className="text-slate-700 mt-1">{coach.notes}</p>
                      </div>
                    )}
                    {!coach.role && !coach.notes && (
                      <p className="text-slate-400 italic">No details added yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Trends Summary */}
            <Card className="border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    Development Trends
                  </CardTitle>
                  {coach.aiTrendSummaryDate && (
                    <CardDescription>Last updated: {formatDate(coach.aiTrendSummaryDate)}</CardDescription>
                  )}
                </div>
                <Button 
                  onClick={handleGenerateTrends}
                  disabled={isGeneratingTrends || sessions.length === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="generate-trends-btn"
                >
                  {isGeneratingTrends ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {coach.aiTrendSummary ? 'Refresh' : 'Generate'}
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {coach.aiTrendSummary ? (
                  <div className="prose prose-slate prose-sm max-w-none">
                    {coach.aiTrendSummary.split('\n').map((paragraph, i) => (
                      paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">
                    {sessions.length === 0 
                      ? 'Complete some observations to generate trend analysis'
                      : 'Click "Generate" to create an AI analysis of coaching trends'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-6">
            {/* Add Target */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Development Targets</CardTitle>
                <CardDescription>Set specific, actionable targets for this coach's development</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="e.g., Increase use of questioning during practice"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTarget()}
                    data-testid="new-target-input"
                  />
                  <Button onClick={handleAddTarget} data-testid="add-target-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Active Targets */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-700 flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-500" />
                    Active Targets ({activeTargets.length})
                  </h4>
                  {activeTargets.length === 0 ? (
                    <p className="text-slate-400 italic text-sm">No active targets</p>
                  ) : (
                    <div className="space-y-2">
                      {activeTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-orange-400 hover:bg-orange-100 flex items-center justify-center"
                          />
                          <span className="flex-1 text-slate-700">{target.text}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteTarget(target.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Achieved Targets */}
                {achievedTargets.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Achieved ({achievedTargets.length})
                    </h4>
                    <div className="space-y-2">
                      {achievedTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </button>
                          <span className="flex-1 text-slate-500 line-through">{target.text}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteTarget(target.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-['Manrope']">Observation History</CardTitle>
                  <CardDescription>{sessions.length} sessions recorded</CardDescription>
                </div>
                <Button onClick={() => navigate(`/session/new?coachId=${coachId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No observations recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map(session => (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                        onClick={() => navigate(`/session/${session.id}/review`)}
                      >
                        <div>
                          <h4 className="font-medium text-slate-900">{session.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span>{formatDate(session.createdAt)}</span>
                            <span>•</span>
                            <span>{formatTime(session.totalDuration)}</span>
                            <span>•</span>
                            <span>{session.events?.length || 0} events</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Completed' : session.status}
                          </Badge>
                          <Eye className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
