import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, TrendingUp, Calendar, Target, Search, Filter, 
  Loader2, Eye, Edit2, Check, X, Archive, Plus, ChevronDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { fetchCoachSessions, fetchCoachDashboard } from '../lib/offlineApi';
import { useAuth } from '../contexts/AuthContext';
import { safeGet, safePut, safePost } from '../lib/safeFetch';
import { toast } from 'sonner';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const API_URL = '';

// Color palette for charts
const CHART_COLORS = ['#FACC15', '#38BDF8', '#4ADE80', '#F97316', '#A855F7', '#EC4899'];

// Timeframe options
const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: '6months', label: 'Last 6 Months' },
  { value: 'year', label: 'This Year' }
];

export default function CoachMyDevelopment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  
  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [targets, setTargets] = useState([]);
  const [archivedTargets, setArchivedTargets] = useState([]);
  
  // Filter/search states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [timeframe, setTimeframe] = useState('all');
  
  // Edit states
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [editingTargetText, setEditingTargetText] = useState('');
  const [newTargetText, setNewTargetText] = useState('');
  const [showAddTarget, setShowAddTarget] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load dashboard data (includes profile and targets)
      const dashResult = await fetchCoachDashboard();
      if (dashResult.ok) {
        setDashboard(dashResult.data);
        const allTargets = dashResult.data?.targets || [];
        setTargets(allTargets.filter(t => t.status !== 'archived'));
        setArchivedTargets(allTargets.filter(t => t.status === 'archived'));
      }
      
      // Load sessions
      const sessionsResult = await fetchCoachSessions();
      if (sessionsResult.ok) {
        setSessions(sessionsResult.data || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load development data');
    } finally {
      setLoading(false);
    }
  };

  // Filter sessions based on search and date
  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    
    // Apply timeframe filter
    const now = new Date();
    if (timeframe === 'month') {
      const start = startOfMonth(now);
      result = result.filter(s => new Date(s.date) >= start);
    } else if (timeframe === '3months') {
      const start = subMonths(now, 3);
      result = result.filter(s => new Date(s.date) >= start);
    } else if (timeframe === '6months') {
      const start = subMonths(now, 6);
      result = result.filter(s => new Date(s.date) >= start);
    } else if (timeframe === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      result = result.filter(s => new Date(s.date) >= start);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.title || '').toLowerCase().includes(query) ||
        (s.session_name || '').toLowerCase().includes(query) ||
        (s.observer_name || '').toLowerCase().includes(query)
      );
    }
    
    // Apply date range filter
    if (dateFilter.start && dateFilter.end) {
      const start = new Date(dateFilter.start);
      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate >= start && sessionDate <= end;
      });
    }
    
    return result.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions, searchQuery, dateFilter, timeframe]);

  // Calculate analytics from filtered sessions
  const analytics = useMemo(() => {
    const totalSessions = filteredSessions.length;
    let totalInterventions = 0;
    const interventionTypes = {};
    const monthlyData = {};
    
    filteredSessions.forEach(session => {
      // Count interventions
      const interventionCount = session.intervention_count || session.events?.length || 0;
      totalInterventions += interventionCount;
      
      // Aggregate by month
      const monthKey = format(new Date(session.date), 'yyyy-MM');
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      
      // TODO: Aggregate intervention types when data is available
    });
    
    const avgPerSession = totalSessions > 0 ? Math.round(totalInterventions / totalSessions) : 0;
    
    // Convert monthly data to chart format
    const monthlyChartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({
        month: format(new Date(month + '-01'), 'MMM yy'),
        sessions: count
      }));
    
    return {
      totalSessions,
      totalInterventions,
      avgPerSession,
      monthlyChartData
    };
  }, [filteredSessions]);

  // Target management functions
  const handleSaveTarget = async (targetId, newText) => {
    if (!newText.trim()) return;
    
    setSavingTarget(true);
    try {
      const result = await safePut(`${API_URL}/api/coach/targets/${targetId}`, {
        text: newText.trim()
      });
      
      if (result.ok) {
        setTargets(prev => prev.map(t => 
          t.id === targetId ? { ...t, text: newText.trim() } : t
        ));
        setEditingTargetId(null);
        toast.success('Target updated');
      } else {
        toast.error('Failed to update target');
      }
    } catch (err) {
      toast.error('Failed to update target');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleArchiveTarget = async (targetId) => {
    try {
      const result = await safePut(`${API_URL}/api/coach/targets/${targetId}`, {
        status: 'archived'
      });
      
      if (result.ok) {
        const target = targets.find(t => t.id === targetId);
        setTargets(prev => prev.filter(t => t.id !== targetId));
        if (target) {
          setArchivedTargets(prev => [...prev, { ...target, status: 'archived' }]);
        }
        toast.success('Target archived');
      }
    } catch (err) {
      toast.error('Failed to archive target');
    }
  };

  const handleRestoreTarget = async (targetId) => {
    try {
      const result = await safePut(`${API_URL}/api/coach/targets/${targetId}`, {
        status: 'active'
      });
      
      if (result.ok) {
        const target = archivedTargets.find(t => t.id === targetId);
        setArchivedTargets(prev => prev.filter(t => t.id !== targetId));
        if (target) {
          setTargets(prev => [...prev, { ...target, status: 'active' }]);
        }
        toast.success('Target restored');
      }
    } catch (err) {
      toast.error('Failed to restore target');
    }
  };

  const handleAddTarget = async () => {
    if (!newTargetText.trim()) return;
    
    setSavingTarget(true);
    try {
      const result = await safePost(`${API_URL}/api/coach/targets`, {
        text: newTargetText.trim()
      });
      
      if (result.ok) {
        setTargets(prev => [...prev, result.data]);
        setNewTargetText('');
        setShowAddTarget(false);
        toast.success('Target added');
      } else {
        toast.error('Failed to add target');
      }
    } catch (err) {
      toast.error('Failed to add target');
    } finally {
      setSavingTarget(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const profile = dashboard?.profile || {};
  const achievedTargets = targets.filter(t => t.status === 'achieved');
  const activeTargets = targets.filter(t => t.status === 'active' || t.status === 'in_progress');

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 font-['Manrope']">My Development</h1>
          <p className="text-sm text-slate-500">Track your coaching journey and progress</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="targets" data-testid="tab-targets">My Targets</TabsTrigger>
          </TabsList>

          {/* ==================== OVERVIEW TAB ==================== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-slate-900">{analytics.totalSessions}</p>
                  <p className="text-sm text-slate-500 mt-1">Sessions Observed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-slate-900">{analytics.totalInterventions}</p>
                  <p className="text-sm text-slate-500 mt-1">Total Interventions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{analytics.avgPerSession}</p>
                  <p className="text-sm text-slate-500 mt-1">Avg per Session</p>
                </CardContent>
              </Card>
            </div>

            {/* Development Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Development Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>{achievedTargets.length} of {targets.length} targets achieved</span>
                    <span className="font-medium">
                      {targets.length > 0 ? Math.round((achievedTargets.length / targets.length) * 100) : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={targets.length > 0 ? (achievedTargets.length / targets.length) * 100 : 0} 
                    className="h-3"
                  />
                </div>

                {activeTargets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Current Focus Areas:</h4>
                    <ul className="space-y-1">
                      {activeTargets.slice(0, 3).map(t => (
                        <li key={t.id} className="text-sm text-slate-600 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {t.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sessions Over Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Sessions Over Time
                </CardTitle>
                <CardDescription>Your observation sessions by month</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.monthlyChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }} 
                        />
                        <Bar dataKey="sessions" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    No session data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== MY SESSIONS TAB ==================== */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="session-search"
                    />
                  </div>
                  
                  {/* Timeframe Filter */}
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger className="w-40" data-testid="timeframe-select">
                      <SelectValue placeholder="Time period" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES.map(tf => (
                        <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Date Range */}
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                      className="w-36"
                      data-testid="date-filter-start"
                    />
                    <Input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                      className="w-36"
                      data-testid="date-filter-end"
                    />
                    {(dateFilter.start || dateFilter.end) && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDateFilter({ start: '', end: '' })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions List */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">
                  Sessions ({filteredSessions.length})
                </CardTitle>
                <CardDescription>Click a session to view full details</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No sessions found</p>
                    {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSessions.map(session => (
                      <div
                        key={session.session_id}
                        className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors border border-slate-100"
                        onClick={() => navigate(`/session/${session.session_id}/review?view=coach`)}
                        data-testid={`session-item-${session.session_id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">
                              {session.title || session.session_name || 'Untitled Session'}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(session.date)}
                              </span>
                              {session.observer_name && (
                                <>
                                  <span>•</span>
                                  <span>Observer: {session.observer_name}</span>
                                </>
                              )}
                            </div>
                            
                            {/* Session indicators */}
                            <div className="flex gap-2 mt-2">
                              {session.has_observation && (
                                <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                  Has Observation
                                </Badge>
                              )}
                              {session.has_reflection && (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                  Has Reflection
                                </Badge>
                              )}
                            </div>
                            
                            {/* Summary preview */}
                            {session.summary_preview && (
                              <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                {session.summary_preview}
                              </p>
                            )}
                          </div>
                          <Eye className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== MY TARGETS TAB ==================== */}
          <TabsContent value="targets" className="space-y-6">
            {/* Active Targets */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <Target className="w-5 h-5 text-orange-500" />
                      Active Targets
                    </CardTitle>
                    <CardDescription>Your current development focus areas</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddTarget(!showAddTarget)}
                    data-testid="add-target-btn"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Target
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Target Form */}
                {showAddTarget && (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <Textarea
                      placeholder="Enter your new development target..."
                      value={newTargetText}
                      onChange={(e) => setNewTargetText(e.target.value)}
                      className="mb-3"
                      data-testid="new-target-input"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleAddTarget}
                        disabled={savingTarget || !newTargetText.trim()}
                        data-testid="save-new-target-btn"
                      >
                        {savingTarget ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        Add Target
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setShowAddTarget(false); setNewTargetText(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Targets List */}
                {activeTargets.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No active targets set</p>
                ) : (
                  <div className="space-y-3">
                    {activeTargets.map(target => (
                      <div 
                        key={target.id} 
                        className="p-4 bg-orange-50 rounded-lg border border-orange-200 group"
                      >
                        {editingTargetId === target.id ? (
                          <div>
                            <Textarea
                              value={editingTargetText}
                              onChange={(e) => setEditingTargetText(e.target.value)}
                              className="mb-2"
                              data-testid={`edit-target-input-${target.id}`}
                            />
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleSaveTarget(target.id, editingTargetText)}
                                disabled={savingTarget}
                              >
                                {savingTarget ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setEditingTargetId(null)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-slate-700">{target.text}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                Set on {formatDate(target.createdAt || target.created_at)}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingTargetId(target.id);
                                  setEditingTargetText(target.text);
                                }}
                                data-testid={`edit-target-${target.id}`}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-orange-600"
                                onClick={() => handleArchiveTarget(target.id)}
                                data-testid={`archive-target-${target.id}`}
                              >
                                <Archive className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Achieved Targets */}
                {achievedTargets.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                      Achieved
                      <Badge className="bg-green-600">{achievedTargets.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {achievedTargets.map(target => (
                        <div key={target.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-600" />
                            <p className="text-slate-500 line-through">{target.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Archived Targets */}
            {archivedTargets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2 text-slate-500">
                    <Archive className="w-5 h-5" />
                    Archived Targets ({archivedTargets.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {archivedTargets.map(target => (
                      <div key={target.id} className="p-3 bg-slate-100 rounded-lg flex items-center justify-between">
                        <p className="text-slate-500">{target.text}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreTarget(target.id)}
                          data-testid={`restore-target-${target.id}`}
                        >
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
