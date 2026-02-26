import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Check, X, Target, Calendar, User, Sparkles, 
  Loader2, Eye, Play, Download, FileText, Filter, Camera, Paperclip, Upload, 
  CalendarClock, BarChart3, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, ArrowUpCircle, Lock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Checkbox } from '../components/ui/checkbox';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { storage } from '../lib/storage';
import { deleteCloudSession } from '../lib/cloudSessionService';
import { formatDate, formatTime, generateId, calcPercentage, countBy } from '../lib/utils';
import { exportCoachReportPDF, exportCoachReportCSV } from '../lib/export';
import { fetchSessionParts } from '../lib/sessionPartsApi';
import { useAuth } from '../contexts/AuthContext';
import { useUpgrade } from '../contexts/UpgradeContext';
import { SessionFilters, applySessionFilters, calculateFilteredAnalytics } from '../components/SessionFilters';
import CoachNotes from '../components/coach/CoachNotes';
import axios from 'axios';
import { getAuthToken } from '../lib/safeFetch';

const API = '/api';

// Helper to get axios config with auth headers
const getAxiosConfig = () => {
  const token = getAuthToken();
  return {
    withCredentials: true,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  };
};

// Color palette for charts
const CHART_COLORS = ['#FACC15', '#38BDF8', '#4ADE80', '#F97316', '#A855F7', '#EC4899'];

export default function CoachProfile() {
  const navigate = useNavigate();
  const { coachId } = useParams();
  const { isCoachDeveloper, user } = useAuth();
  const { openUpgradeModal } = useUpgrade();
  
  const [coach, setCoach] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [dataRetention, setDataRetention] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [isGeneratingTrends, setIsGeneratingTrends] = useState(false);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [interventionFilters, setInterventionFilters] = useState({});
  const [interventionDetailsExpanded, setInterventionDetailsExpanded] = useState(false);
  
  // Session filters state
  const [sessionFilters, setSessionFilters] = useState({
    timeframe: 'all',
    startDate: '',
    endDate: '',
    sessionType: 'all',
    daysOfWeek: [],
    sessionParts: []
  });
  
  // Report export state
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Session part filtering - extract unique parts from sessions
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPartFilter, setSelectedPartFilter] = useState('all');
  
  // Extract unique session parts from all sessions (only parts that were actually used)
  const availableSessionParts = useMemo(() => {
    const partsSet = new Set();
    sessions.forEach(session => {
      const parts = session.session_parts || session.sessionParts || session.parts || [];
      parts.forEach(part => {
        // Only include parts that were actually used in the session
        const partName = part.name || part.part_name || part;
        const wasUsed = part.used !== false; // Default to true if 'used' field doesn't exist
        if (partName && wasUsed) partsSet.add(partName);
      });
    });
    return Array.from(partsSet).sort();
  }, [sessions]);
  
  // Photo upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  useEffect(() => {
    loadCoach();
    loadSessionParts();
    loadAnalytics();
  }, [coachId]);

  const loadCoach = async () => {
    setIsLoadingSessions(true);
    try {
      // Load from API instead of localStorage
      const response = await axios.get(`${API}/coaches/${coachId}`, getAxiosConfig());
      const loaded = response.data;
      
      if (!loaded) {
        toast.error('Coach not found');
        navigate('/coaches');
        return;
      }
      setCoach(loaded);
      setEditName(loaded.name);
      setEditRole(loaded.role_title || loaded.role || '');
      setEditNotes(loaded.notes || '');
      
      // Load sessions for this coach from API
      try {
        const sessionsResponse = await axios.get(`${API}/coaches/${coachId}/sessions`, { withCredentials: true });
        // Handle new response format with data_retention info
        if (sessionsResponse.data?.sessions) {
          setSessions(sessionsResponse.data.sessions || []);
          setDataRetention(sessionsResponse.data.data_retention || null);
        } else {
          // Fallback for old response format (array)
          setSessions(sessionsResponse.data || []);
        }
      } catch (sessErr) {
        console.warn('Failed to load coach sessions from API:', sessErr);
        // Fall back to localStorage for sessions if API fails
        const coachSessions = storage.getCoachSessions(coachId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setSessions(coachSessions);
      } finally {
        setIsLoadingSessions(false);
      }
    } catch (err) {
      console.error('Failed to load coach:', err);
      toast.error('Coach not found');
      setIsLoadingSessions(false);
      navigate('/coaches');
    }
  };

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await axios.get(`${API}/coaches/${coachId}/analytics`, { withCredentials: true });
      setAnalyticsData(response.data);
      
      // Extract data retention info if present
      if (response.data?.data_retention) {
        setDataRetention(response.data.data_retention);
      }
      
      // Initialize intervention filters when analytics data loads
      if (response.data?.intervention_chart_data) {
        const initialFilters = {};
        response.data.intervention_chart_data.forEach(item => {
          initialFilters[item.name] = true; // All checked by default
        });
        setInterventionFilters(initialFilters);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalyticsData(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const loadSessionParts = async () => {
    try {
      const parts = await fetchSessionParts();
      setAvailableParts(parts);
    } catch (err) {
      console.error('Failed to load session parts:', err);
    }
  };

  // Toggle intervention filter
  const toggleInterventionFilter = (interventionName) => {
    setInterventionFilters(prev => ({
      ...prev,
      [interventionName]: !prev[interventionName]
    }));
  };

  // Filter sessions based on session filters
  const filteredSessions = useMemo(() => {
    // Apply explicit filters first
    let result = applySessionFilters(sessions, sessionFilters);
    
    // For Individual/free tier users, always enforce the 3-month limit
    // This ensures data is filtered even before the user interacts with filters
    if (dataRetention?.is_limited && sessionFilters.timeframe === 'all') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      result = result.filter(s => {
        const sessionDate = new Date(s.date || s.created_at || s.createdAt);
        return sessionDate >= threeMonthsAgo;
      });
    }
    
    return result;
  }, [sessions, sessionFilters, dataRetention]);

  // Calculate filtered analytics based on the current filters
  // Uses the new calculateFilteredAnalytics helper that properly filters by session parts
  const filteredAnalytics = useMemo(() => {
    if (!analyticsData) return null;
    
    // Check if any filters are active OR if tier-based filtering is needed
    const hasActiveFilters = sessionFilters.timeframe !== 'all' || 
                            sessionFilters.sessionType !== 'all' || 
                            sessionFilters.daysOfWeek.length > 0 ||
                            (sessionFilters.sessionParts && sessionFilters.sessionParts.length > 0);
    
    // Also recalculate if tier-based filtering is applied
    const needsTierFiltering = dataRetention?.is_limited && sessionFilters.timeframe === 'all';
    
    // If no filters and no tier filtering needed, return original analytics
    if (!hasActiveFilters && !needsTierFiltering) return analyticsData;
    
    // Use the new helper that properly handles session parts filtering
    // This ensures that when filtering by parts, only events FROM those parts are counted
    return calculateFilteredAnalytics(filteredSessions, sessionFilters.sessionParts || []);
  }, [analyticsData, filteredSessions, sessionFilters, dataRetention]);

  // Filter intervention data based on selected checkbox filters (uses filtered analytics)
  const filteredInterventionData = useMemo(() => {
    const chartData = filteredAnalytics?.intervention_chart_data || analyticsData?.intervention_chart_data || [];
    return chartData.filter(item => interventionFilters[item.name] !== false);
  }, [filteredAnalytics, analyticsData, interventionFilters]);

  // Helper to check if a session is accessible based on data retention
  const isSessionAccessible = (session) => {
    if (!dataRetention?.is_limited || !dataRetention?.cutoff_date) return true;
    const sessionDate = new Date(session.createdAt || session.created_at);
    const cutoffDate = new Date(dataRetention.cutoff_date);
    return sessionDate >= cutoffDate;
  };

  // Handler for clicking on restricted sessions
  const handleRestrictedSessionClick = (e) => {
    e.stopPropagation();
    toast.error(
      <div>
        <p className="font-medium">Session not accessible</p>
        <p className="text-sm">Upgrade your plan to view sessions older than 3 months.</p>
      </div>,
      {
        action: {
          label: 'View Plans',
          onClick: openUpgradeModal
        }
      }
    );
  };

  // Photo upload handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      const updatedCoach = { ...coach, photoUrl: data.url };
      saveCoach(updatedCoach);
      toast.success('Photo uploaded successfully');
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    const updatedCoach = { ...coach, photoUrl: null };
    saveCoach(updatedCoach);
    toast.success('Photo removed');
  };

  // File attachment upload handler
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }
    
    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      const newAttachment = {
        id: data.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: data.url,
        uploadedAt: new Date().toISOString()
      };
      
      const updatedCoach = { 
        ...coach, 
        attachments: [...(coach.attachments || []), newAttachment] 
      };
      saveCoach(updatedCoach);
      toast.success('File attached successfully');
    } catch (err) {
      console.error('Attachment upload error:', err);
      toast.error('Failed to upload file');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (attachmentId) => {
    const updatedCoach = {
      ...coach,
      attachments: (coach.attachments || []).filter(a => a.id !== attachmentId)
    };
    saveCoach(updatedCoach);
    toast.success('Attachment removed');
  };

  // Delete a session
  const handleDeleteSession = async (sessionId) => {
    try {
      // Delete from cloud
      await deleteCloudSession(sessionId);
      // Delete from localStorage as backup
      storage.deleteSession(sessionId);
      // Refresh sessions list
      setSessions(prev => prev.filter(s => (s.id || s.session_id) !== sessionId));
      toast.success('Session deleted');
    } catch (err) {
      console.error('Failed to delete session:', err);
      toast.error('Failed to delete session');
    }
  };

  // Save coach info edit
  const handleSaveEdit = () => {
    const updatedCoach = {
      ...coach,
      name: editName,
      role: editRole,
      notes: editNotes
    };
    saveCoach(updatedCoach);
    toast.success('Coach information updated');
  };

  // Get all unique session parts used across this coach's sessions
  const getAllUsedParts = () => {
    const usedParts = new Set();
    sessions.forEach(s => {
      (s.sessionParts || []).forEach(p => {
        usedParts.add(JSON.stringify({ id: p.id, name: p.name }));
      });
    });
    return Array.from(usedParts).map(p => JSON.parse(p));
  };

  // Filter sessions by selected part
  const getFilteredSessions = () => {
    if (selectedPartFilter === 'all') return sessions;
    return sessions.filter(s => 
      (s.sessionParts || []).some(p => p.name === selectedPartFilter || p.id === selectedPartFilter)
    );
  };

  // Calculate stats for filtered sessions
  const getFilteredStats = () => {
    const filtered = getFilteredSessions();
    const completedSessions = filtered.filter(s => s.status === 'completed');
    
    const totalEvents = completedSessions.reduce((sum, s) => {
      const events = s.events || [];
      if (selectedPartFilter === 'all') return sum + events.length;
      // Filter events by session part
      return sum + events.filter(e => {
        const part = (s.sessionParts || []).find(p => p.id === e.sessionPartId);
        return part && (part.name === selectedPartFilter || part.id === selectedPartFilter);
      }).length;
    }, 0);

    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalBallRolling = completedSessions.reduce((sum, s) => sum + (s.ballRollingTime || 0), 0);
    const totalBallStopped = completedSessions.reduce((sum, s) => sum + (s.ballNotRollingTime || 0), 0);
    
    return {
      sessionCount: completedSessions.length,
      totalEvents,
      totalDuration,
      avgBallRolling: calcPercentage(totalBallRolling, totalBallRolling + totalBallStopped)
    };
  };

  const saveCoach = async (updated) => {
    try {
      // Save to API
      await axios.put(`${API}/coaches/${coachId}`, updated, { withCredentials: true });
      setCoach(updated);
    } catch (err) {
      console.error('Failed to save coach:', err);
      toast.error('Failed to save changes');
    }
  };

  const handleSaveDetails = async () => {
    const updated = {
      ...coach,
      name: editName,
      role_title: editRole,
      notes: editNotes
    };
    await saveCoach(updated);
    setIsEditing(false);
    toast.success('Profile updated');
  };

  const handleAddTarget = async () => {
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
    await saveCoach(updated);
    setNewTarget('');
    toast.success('Target added');
  };

  const handleToggleTarget = async (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.map(t => 
        t.id === targetId 
          ? { ...t, status: t.status === 'active' ? 'achieved' : 'active' }
          : t
      )
    };
    await saveCoach(updated);
  };

  const handleDeleteTarget = async (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.filter(t => t.id !== targetId)
    };
    await saveCoach(updated);
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

  // Use filtered analytics if filters are active, otherwise use API analytics
  const analytics = filteredAnalytics || analyticsData || {
    total_sessions: filteredSessions.length,
    total_interventions: 0,
    avg_per_session: 0,
    avg_ball_rolling: 0,
    intervention_chart_data: [],
    variety_percentage: 0,
    most_common_pattern: null
  };

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
              {/* Coach Photo */}
              <div className="relative group">
                {coach.photoUrl ? (
                  <img 
                    src={coach.photoUrl} 
                    alt={coach.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                )}
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
        {/* Data Retention Upgrade Banner */}
        {dataRetention?.is_limited && dataRetention?.hidden_sessions_count > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">
                    {dataRetention.hidden_sessions_count} older session{dataRetention.hidden_sessions_count > 1 ? 's' : ''} not shown
                  </p>
                  <p className="text-sm text-amber-700">
                    Your {dataRetention.tier} plan shows data from the last {dataRetention.months_limit} months. 
                    Upgrade to access all historical data.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-amber-400 text-amber-700 hover:bg-amber-100"
                onClick={() => navigate('/settings?tab=subscription')}
                data-testid="upgrade-btn"
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="development" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="development" data-testid="tab-development">Coach Development</TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          </TabsList>

          {/* ==================== COACH DEVELOPMENT TAB ==================== */}
          <TabsContent value="development" className="space-y-6">
            {/* Coach Profile Card with Active Targets */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Coach Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                    {coach.photoUrl || coach.photo ? (
                      <img src={coach.photoUrl || coach.photo} alt={coach.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-medium text-slate-500">{coach.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">{coach.name}</h3>
                    {coach.role_title && <p className="text-slate-600">{coach.role_title}</p>}
                    {(coach.age_group || coach.department) && (
                      <p className="text-sm text-slate-500">
                        {[coach.age_group, coach.department].filter(Boolean).join(' | ')}
                      </p>
                    )}
                    {coach.bio && (
                      <p className="text-sm text-slate-600 mt-2">{coach.bio}</p>
                    )}
                  </div>
                  {/* Active Targets mini card */}
                  <div className="flex-shrink-0 p-3 bg-orange-50 rounded-lg border border-orange-200 text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-orange-600">{activeTargets.length}</p>
                    <p className="text-xs text-orange-700">Active Targets</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Filters */}
            <SessionFilters 
              filters={sessionFilters}
              onFiltersChange={setSessionFilters}
              showCompact={true}
              dataRetention={dataRetention}
              availableSessionParts={availableSessionParts.map(name => ({ name }))}
            />

            {/* Intervention Patterns Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Intervention Patterns
                </CardTitle>
                <CardDescription>Insights into this coach's intervention habits</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : (analytics.total_interventions || 0) > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Most Common Intervention */}
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-sm text-purple-700 font-medium">Most Used</p>
                      <p className="text-xl font-bold text-purple-900 mt-1">
                        {analytics.most_common_pattern?.pattern || 'N/A'}
                      </p>
                      {analytics.most_common_pattern && (
                        <p className="text-sm text-purple-600 mt-1">
                          {analytics.most_common_pattern.count} times ({Math.round((analytics.most_common_pattern.count / analytics.total_interventions) * 100)}%)
                        </p>
                      )}
                    </div>
                    
                    {/* Variety */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-700 font-medium">Variety Score</p>
                      <p className="text-xl font-bold text-blue-900 mt-1">
                        {analytics.variety_percentage || 0}%
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        {(analytics.variety_percentage || 0) > 50 ? 'High variety in approaches' : 'Consistent patterns'}
                      </p>
                    </div>
                    
                    {/* Ball Rolling Insight */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-sm text-green-700 font-medium">Ball Rolling Balance</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-green-200 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-green-500 h-full rounded-full" 
                            style={{ width: `${analytics.avg_ball_rolling || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-green-900">{analytics.avg_ball_rolling || 0}%</span>
                      </div>
                      <p className="text-sm text-green-600 mt-2">
                        {(analytics.avg_ball_rolling || 0) >= 60 ? 'Great activity flow!' : 
                         (analytics.avg_ball_rolling || 0) >= 40 ? 'Balanced approach' : 'More ball time could help'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    Complete some observation sessions to see intervention patterns
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Metrics Row - 3 metrics in one row */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-slate-900" data-testid="total-sessions-count">
                    {isLoadingAnalytics ? <Skeleton className="h-9 w-16 mx-auto" /> : (analytics.total_sessions ?? sessions.length)}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Sessions Observed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600" data-testid="avg-ball-rolling">
                    {isLoadingAnalytics ? <Skeleton className="h-9 w-16 mx-auto" /> : `${analytics.avg_ball_rolling ?? 0}%`}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Avg Ball Rolling</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-blue-600" data-testid="avg-interventions">
                    {isLoadingAnalytics ? <Skeleton className="h-9 w-16 mx-auto" /> : Math.round(analytics.avg_per_session ?? 0)}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Avg Interventions</p>
                </CardContent>
              </Card>
            </div>

            {/* Intervention Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-yellow-500" />
                  Intervention Distribution
                </CardTitle>
                <CardDescription>Breakdown of intervention types across all sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <Skeleton className="h-48 w-full" />
                ) : (analytics.intervention_chart_data || []).length > 0 ? (
                  <div className="space-y-4">
                    {/* Filter toggles */}
                    <div className="flex flex-wrap gap-3 pb-3 border-b border-slate-100">
                      {(analytics.intervention_chart_data || []).map((item, idx) => (
                        <label 
                          key={item.name} 
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <Checkbox
                            checked={interventionFilters[item.name] !== false}
                            onCheckedChange={() => toggleInterventionFilter(item.name)}
                            data-testid={`filter-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                          />
                          <span className="text-sm text-slate-600">{item.name}</span>
                        </label>
                      ))}
                    </div>
                    
                    {/* Chart with filtered data */}
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredInterventionData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <Tooltip 
                            formatter={(value, name, props) => [`${value} (${props.payload.percentage}%)`, 'Count']}
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px'
                            }} 
                          />
                          <Bar dataKey="count" fill="#FACC15" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Collapsible percentage breakdown */}
                    <Collapsible open={interventionDetailsExpanded} onOpenChange={setInterventionDetailsExpanded}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full text-slate-500 hover:text-slate-700">
                          {interventionDetailsExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-2" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-2" />
                              Show Details
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                          {(analytics.intervention_chart_data || []).map((item, idx) => (
                            <div key={item.name} className="p-3 bg-slate-50 rounded-lg text-center">
                              <p className="text-lg font-bold" style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}>
                                {item.percentage}%
                              </p>
                              <p className="text-xs text-slate-500">{item.name}</p>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400">
                    No intervention data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Development Targets */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Development Targets
                </CardTitle>
                <CardDescription>Focus areas used in AI summaries and development trends</CardDescription>
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
                    Active Focus Areas ({activeTargets.length})
                  </h4>
                  {activeTargets.length === 0 ? (
                    <p className="text-slate-400 italic text-sm">No active targets - add one above to track development focus</p>
                  ) : (
                    <div className="space-y-2">
                      {activeTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-orange-400 hover:bg-orange-100 flex items-center justify-center"
                            title="Mark as achieved"
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
                      Completed Focus Areas ({achievedTargets.length})
                    </h4>
                    <div className="space-y-2">
                      {achievedTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 flex items-center justify-center"
                            title="Mark as active again"
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

          {/* Profile Tab - Photo & Attachments */}
          <TabsContent value="profile" className="space-y-6">
            {/* Photo Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Profile Photo
                </CardTitle>
                <CardDescription>
                  Upload a photo for this coach's profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  {/* Photo Preview */}
                  <div className="relative">
                    {coach.photoUrl ? (
                      <img 
                        src={coach.photoUrl} 
                        alt={coach.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-slate-100"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-slate-100">
                        <User className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Controls */}
                  <div className="space-y-3">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                        disabled={isUploadingPhoto}
                      />
                      <label htmlFor="photo-upload">
                        <Button asChild disabled={isUploadingPhoto} className="cursor-pointer">
                          <span>
                            {isUploadingPhoto ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {coach.photoUrl ? 'Change Photo' : 'Upload Photo'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    {coach.photoUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove Photo
                      </Button>
                    )}
                    <p className="text-xs text-slate-500">
                      Recommended: Square image, max 5MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments
                </CardTitle>
                <CardDescription>
                  Attach development plans, certificates, or other documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    id="attachment-upload"
                    disabled={isUploadingAttachment}
                  />
                  <label htmlFor="attachment-upload">
                    <Button asChild variant="outline" disabled={isUploadingAttachment} className="cursor-pointer">
                      <span>
                        {isUploadingAttachment ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add Attachment
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    Max file size: 10MB
                  </p>
                </div>

                {/* Attachments List */}
                {(coach.attachments || []).length > 0 ? (
                  <div className="space-y-2">
                    {(coach.attachments || []).map(attachment => (
                      <div 
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-slate-400" />
                          <div>
                            <a 
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline text-sm"
                            >
                              {attachment.name}
                            </a>
                            <p className="text-xs text-slate-500">
                              {(attachment.size / 1024).toFixed(1)} KB | {new Date(attachment.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No attachments yet</p>
                )}
              </CardContent>
            </Card>

            {/* Coach Info Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Edit2 className="w-5 h-5" />
                  Coach Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="e.g., U14 Head Coach"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this coach..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleSaveEdit}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            {/* Coach Notes */}
            <CoachNotes
              coachId={coachId}
              coachName={coach.name}
              currentUserRole={isCoachDeveloper ? 'coach_developer' : 'coach'}
              currentUserId={user?.user_id}
              isOwnProfile={false}
            />
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-['Manrope']">Sessions</CardTitle>
                  <CardDescription>
                    {isLoadingSessions ? 'Loading sessions...' : `${sessions.length} sessions`}
                  </CardDescription>
                </div>
                <Button onClick={() => navigate(`/session/new?coachId=${coachId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  // Skeleton loading state
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No observations recorded yet</p>
                ) : (
                  <div className="space-y-6">
                    {/* Upcoming Sessions (planned) */}
                    {(() => {
                      const upcomingSessions = sessions.filter(s => s.status === 'planned');
                      if (upcomingSessions.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                            <CalendarClock className="w-4 h-4" />
                            Upcoming ({upcomingSessions.length})
                          </h4>
                          <div className="space-y-3">
                            {upcomingSessions.map(session => {
                              const sessionId = session.id || session.session_id;
                              return (
                                <div 
                                  key={sessionId}
                                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
                                >
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => navigate(`/session/${sessionId}/setup`)}
                                  >
                                    <h4 className="font-medium text-slate-900">{session.name || session.title}</h4>
                                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                      <span>Scheduled: {formatDate(session.plannedDate || session.planned_date || session.createdAt || session.created_at)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-blue-500 hover:bg-blue-500">Planned</Badge>
                                    <Button 
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => navigate(`/session/${sessionId}/setup`)}
                                      title="Edit"
                                    >
                                      <Edit2 className="w-4 h-4 text-slate-500" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Planned Session?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete "{session.name || session.title}". This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteSession(sessionId)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    <Button 
                                      size="sm"
                                      className="bg-orange-500 hover:bg-orange-600"
                                      onClick={() => navigate(`/session/${sessionId}/observe`)}
                                    >
                                      <Play className="w-4 h-4 mr-1" />
                                      Start
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Completed Sessions */}
                    {(() => {
                      const completedSessions = sessions.filter(s => s.status === 'completed');
                      if (completedSessions.length === 0 && sessions.filter(s => s.status === 'planned').length > 0) {
                        return (
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-3">Observation History</h4>
                            <p className="text-slate-400 italic text-center py-4">No completed observations yet</p>
                          </div>
                        );
                      }
                      if (completedSessions.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-3">Observation History ({completedSessions.length})</h4>
                          <div className="space-y-3">
                            {completedSessions.map(session => {
                              const accessible = isSessionAccessible(session);
                              return (
                                <div 
                                  key={session.id || session.session_id}
                                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${
                                    accessible 
                                      ? 'bg-slate-50 hover:bg-slate-100' 
                                      : 'bg-slate-100 opacity-60 border border-slate-200'
                                  }`}
                                  onClick={accessible 
                                    ? () => navigate(`/session/${session.id || session.session_id}/review`)
                                    : handleRestrictedSessionClick
                                  }
                                >
                                  <div>
                                    <h4 className={`font-medium ${accessible ? 'text-slate-900' : 'text-slate-500'}`}>
                                      {session.name || session.title}
                                    </h4>
                                    <div className={`flex items-center gap-3 text-sm mt-1 ${accessible ? 'text-slate-500' : 'text-slate-400'}`}>
                                      <span>{formatDate(session.createdAt || session.created_at)}</span>
                                      <span>|</span>
                                      <span>{formatTime(session.totalDuration || session.total_duration || 0)}</span>
                                      <span>|</span>
                                      <span>{session.events?.length || session.event_count || 0} events</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {accessible ? (
                                      <>
                                        <Badge className="bg-green-600 hover:bg-green-600">Completed</Badge>
                                        <Eye className="w-4 h-4 text-slate-400" />
                                      </>
                                    ) : (
                                      <>
                                        <Badge variant="outline" className="text-slate-400 border-slate-300">
                                          <Lock className="w-3 h-3 mr-1" />
                                          Locked
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Draft/Active Sessions (if any) */}
                    {(() => {
                      const otherSessions = sessions.filter(s => s.status !== 'planned' && s.status !== 'completed');
                      if (otherSessions.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-3">In Progress ({otherSessions.length})</h4>
                          <div className="space-y-3">
                            {otherSessions.map(session => (
                              <div 
                                key={session.id || session.session_id}
                                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer border border-orange-200"
                                onClick={() => navigate(`/session/${session.id || session.session_id}/observe`)}
                              >
                                <div>
                                  <h4 className="font-medium text-slate-900">{session.name || session.title}</h4>
                                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                    <span>{formatDate(session.createdAt || session.created_at)}</span>
                                    <span>|</span>
                                    <span>{session.events?.length || session.event_count || 0} events</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-orange-500 hover:bg-orange-500">{session.status}</Badge>
                                  <Play className="w-4 h-4 text-slate-400" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Export Report
                </CardTitle>
                <CardDescription>
                  Generate a consolidated report for a specific time period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="report-start-date">Start Date</Label>
                    <Input
                      id="report-start-date"
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="mt-1"
                      data-testid="report-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="report-end-date">End Date</Label>
                    <Input
                      id="report-end-date"
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="mt-1"
                      data-testid="report-end-date"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div>
                  <Label className="text-slate-500 text-sm">Quick Select</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastWeek = new Date(today);
                        lastWeek.setDate(today.getDate() - 7);
                        setReportStartDate(lastWeek.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastMonth = new Date(today);
                        lastMonth.setMonth(today.getMonth() - 1);
                        setReportStartDate(lastMonth.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const last3Months = new Date(today);
                        last3Months.setMonth(today.getMonth() - 3);
                        setReportStartDate(last3Months.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 3 Months
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const startOfYear = new Date(today.getFullYear(), 0, 1);
                        setReportStartDate(startOfYear.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Year to Date
                    </Button>
                  </div>
                </div>

                {/* Export Preview */}
                {reportStartDate && reportEndDate && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-700 mb-2">Report Preview</h4>
                    <p className="text-sm text-slate-600">
                      Period: {formatDate(reportStartDate)} - {formatDate(reportEndDate)}
                    </p>
                    <p className="text-sm text-slate-600">
                      Completed Sessions: {sessions.filter(s => {
                        const sessionDate = new Date(s.createdAt);
                        const start = new Date(reportStartDate);
                        const end = new Date(reportEndDate);
                        end.setHours(23, 59, 59, 999);
                        return sessionDate >= start && sessionDate <= end && s.status === 'completed';
                      }).length}
                    </p>
                  </div>
                )}

                {/* Export Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleExportReport('pdf')}
                    disabled={isExporting || !reportStartDate || !reportEndDate}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="export-pdf-btn"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportReport('csv')}
                    disabled={isExporting || !reportStartDate || !reportEndDate}
                    data-testid="export-csv-btn"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export CSV
                  </Button>
                </div>

                {/* Report Contents Description */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Report includes:</h4>
                  <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                    <li>Session summaries and statistics</li>
                    <li>Intervention breakdown by type</li>
                    <li>Ball rolling time analysis</li>
                    <li>AI-generated insights (if available)</li>
                    <li>Progress towards targets</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
