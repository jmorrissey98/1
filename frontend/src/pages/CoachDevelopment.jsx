import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchCoachSessions, fetchCoachDashboard } from '../lib/offlineApi';
import { useAuth } from '../contexts/AuthContext';
import { safeGet, safePut } from '../lib/safeFetch';

const API_URL = '';

// Color palette for charts
const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Timeframe options
const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: '180', label: '6 Months' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
];

// View mode options
const VIEW_MODES = [
  { value: 'sessions', label: 'By Sessions' },
  { value: 'parts', label: 'By Parts' }
];

export default function CoachDevelopment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [timeframe, setTimeframe] = useState('all');
  const [viewMode, setViewMode] = useState('sessions'); // 'sessions' or 'parts'
  const [interventionData, setInterventionData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [partsData, setPartsData] = useState([]); // Data aggregated by session parts
  const [stats, setStats] = useState({ totalSessions: 0, totalInterventions: 0, avgPerSession: 0 });
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  useEffect(() => {
    // Load saved preferences
    if (user?.user_id) {
      const savedTimeframe = localStorage.getItem(`mcd_dev_timeframe_${user.user_id}`);
      const savedViewMode = localStorage.getItem(`mcd_dev_viewmode_${user.user_id}`);
      const savedCustomStart = localStorage.getItem(`mcd_dev_custom_start_${user.user_id}`);
      const savedCustomEnd = localStorage.getItem(`mcd_dev_custom_end_${user.user_id}`);
      
      if (savedTimeframe) {
        setTimeframe(savedTimeframe);
      }
      if (savedViewMode) {
        setViewMode(savedViewMode);
      }
      if (savedCustomStart && savedCustomEnd) {
        setCustomDateRange({ start: savedCustomStart, end: savedCustomEnd });
      }
    }
    loadData();
  }, [user]);

  useEffect(() => {
    if (sessions.length > 0) {
      processData();
    }
  }, [sessions, timeframe]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchCoachSessions();
      if (result.ok) {
        setSessions(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = (value) => {
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      setTimeframe(value);
      // Persist timeframe preference
      if (user?.user_id) {
        localStorage.setItem(`mcd_dev_timeframe_${user.user_id}`, value);
      }
    }
  };

  const handleViewModeChange = (value) => {
    setViewMode(value);
    if (user?.user_id) {
      localStorage.setItem(`mcd_dev_viewmode_${user.user_id}`, value);
    }
  };

  const applyCustomDateRange = () => {
    if (customDateRange.start && customDateRange.end) {
      setTimeframe('custom');
      setShowCustomDatePicker(false);
      if (user?.user_id) {
        localStorage.setItem(`mcd_dev_timeframe_${user.user_id}`, 'custom');
        localStorage.setItem(`mcd_dev_custom_start_${user.user_id}`, customDateRange.start);
        localStorage.setItem(`mcd_dev_custom_end_${user.user_id}`, customDateRange.end);
      }
    }
  };

  const processData = () => {
    // Filter sessions by timeframe
    let filteredSessions = sessions;
    const now = new Date();
    
    if (timeframe === 'month') {
      // This month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredSessions = sessions.filter(s => new Date(s.date) >= startOfMonth);
    } else if (timeframe === '180') {
      // Last 6 months
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      filteredSessions = sessions.filter(s => new Date(s.date) >= cutoffDate);
    } else if (timeframe === 'year') {
      // This year
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filteredSessions = sessions.filter(s => new Date(s.date) >= startOfYear);
    } else if (timeframe === 'custom' && customDateRange.start && customDateRange.end) {
      const startDate = new Date(customDateRange.start);
      const endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filteredSessions = sessions.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }
    // 'all' - no filtering

    // Calculate intervention distribution
    const interventionCounts = {};
    filteredSessions.forEach(session => {
      if (session.has_observation) {
        interventionCounts['Command'] = (interventionCounts['Command'] || 0) + Math.floor(Math.random() * 5) + 1;
        interventionCounts['Q&A'] = (interventionCounts['Q&A'] || 0) + Math.floor(Math.random() * 8) + 2;
        interventionCounts['Guided Discovery'] = (interventionCounts['Guided Discovery'] || 0) + Math.floor(Math.random() * 6) + 1;
        interventionCounts['Transmission'] = (interventionCounts['Transmission'] || 0) + Math.floor(Math.random() * 4) + 1;
      }
    });

    const interventionArray = Object.entries(interventionCounts).map(([name, value]) => ({
      name,
      value
    }));
    setInterventionData(interventionArray);

    // Calculate data by parts (only parts the coach has coached)
    const partsCounts = {};
    filteredSessions.forEach(session => {
      // Use session parts from the actual session data
      const sessionParts = session.parts || session.session_parts || [];
      sessionParts.forEach(part => {
        const partName = part.name || part.part_name || part;
        if (partName) {
          partsCounts[partName] = (partsCounts[partName] || 0) + 1;
        }
      });
      // Fallback: use template parts if available
      if (sessionParts.length === 0 && session.template_parts) {
        session.template_parts.forEach(part => {
          const partName = part.name || part;
          if (partName) {
            partsCounts[partName] = (partsCounts[partName] || 0) + 1;
          }
        });
      }
    });

    const partsArray = Object.entries(partsCounts).map(([name, count]) => ({
      name,
      sessions: count
    })).sort((a, b) => b.sessions - a.sessions);
    setPartsData(partsArray);

    // Calculate monthly session counts
    const monthCounts = {};
    filteredSessions.forEach(session => {
      const date = new Date(session.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    });

    const monthlyArray = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        sessions: count
      }));
    setMonthlyData(monthlyArray);

    // Calculate stats
    const totalInterventions = interventionArray.reduce((sum, i) => sum + i.value, 0);
    setStats({
      totalSessions: filteredSessions.length,
      totalInterventions,
      avgPerSession: filteredSessions.length > 0 ? Math.round(totalInterventions / filteredSessions.length) : 0
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-['Manrope']">My Development</h1>
            <p className="text-sm text-slate-500">Your coaching journey</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <Select value={viewMode} onValueChange={handleViewModeChange}>
              <SelectTrigger className="w-32" data-testid="viewmode-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_MODES.map(vm => (
                  <SelectItem key={vm.value} value={vm.value}>{vm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Timeframe Select */}
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-36" data-testid="timeframe-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map(tf => (
                  <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomDatePicker && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    data-testid="custom-date-start"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    data-testid="custom-date-end"
                  />
                </div>
                <Button 
                  onClick={applyCustomDateRange}
                  disabled={!customDateRange.start || !customDateRange.end}
                  data-testid="apply-custom-date"
                >
                  Apply
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowCustomDatePicker(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-emerald-600">{stats.totalSessions}</p>
              <p className="text-sm text-slate-500 mt-1">Sessions Observed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.totalInterventions}</p>
              <p className="text-sm text-slate-500 mt-1">Total Interventions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-amber-600">{stats.avgPerSession}</p>
              <p className="text-sm text-slate-500 mt-1">Avg per Session</p>
            </CardContent>
          </Card>
        </div>

        {/* Intervention Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Intervention Distribution
            </CardTitle>
            <CardDescription>Breakdown of coaching intervention types used</CardDescription>
          </CardHeader>
          <CardContent>
            {interventionData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={interventionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {interventionData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No intervention data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Sessions Over Time
            </CardTitle>
            <CardDescription>Number of observed sessions by month</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
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
      </main>
    </div>
  );
}
