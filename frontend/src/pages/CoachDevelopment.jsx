import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, Target, BarChart3, Loader2, CloudOff, RefreshCw, CheckCircle2, Circle, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { useSync } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

// Use relative URL for same-origin requests
const API_URL = '';

// Chart color palettes
const INTERVENTION_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const CONTENT_FOCUS_COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16'];
const DELIVERY_METHOD_COLORS = ['#f97316', '#fb923c', '#fdba74'];

export default function CoachDevelopment() {
  const navigate = useNavigate();
  const { online } = useSync();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [targetsData, setTargetsData] = useState(null);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState(() => {
    // Persist timeframe selection per user
    const saved = localStorage.getItem(`coach_dev_timeframe_${user?.user_id}`);
    return saved || 'all';
  });

  useEffect(() => {
    loadDevelopmentData();
    loadTargetsProgress();
  }, [timeframe]);

  const loadDevelopmentData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/coach/development-data?timeframe=${timeframe}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        let errorText = 'Failed to load development data';
        try {
          errorText = await response.text();
        } catch {
          // ignore text read error
        }
        throw new Error(errorText);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Development data error:', err);
      // Extract error message safely - avoid any non-string values
      let errorMessage = 'Failed to load data';
      if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadTargetsProgress = async () => {
    try {
      const response = await fetch(`${API_URL}/api/coach/targets-progress`, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        setTargetsData(result);
      }
    } catch (err) {
      console.error('Targets progress error:', err);
      // Don't set error for targets - it's optional
    }
  };

  const handleTimeframeChange = (value) => {
    setTimeframe(value);
    if (user?.user_id) {
      localStorage.setItem(`coach_dev_timeframe_${user.user_id}`, value);
    }
  };

  const formatPercent = (value) => `${value}%`;
  
  const getActivityBadge = (level) => {
    switch (level) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'moderate':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Moderate</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Low</Badge>;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'achieved':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Zap className="w-4 h-4 text-amber-600" />;
      default:
        return <Circle className="w-4 h-4 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">My Development</h1>
              <p className="text-sm text-slate-500">Track your coaching progress</p>
            </div>
            {!online && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <CloudOff className="w-4 h-4" />
                <span>Offline</span>
              </div>
            )}
          </div>
          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4 -mb-4 border-b-0">
            <Button
              variant="ghost"
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach')}
              data-testid="nav-dashboard"
            >
              Dashboard
            </Button>
            <Button
              variant="ghost"
              className="rounded-b-none border-b-2 border-emerald-600 text-emerald-700 font-medium"
              data-testid="nav-development"
            >
              My Development
            </Button>
            <Button
              variant="ghost"
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach/sessions')}
              data-testid="nav-sessions"
            >
              My Sessions
            </Button>
            <Button
              variant="ghost"
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach/profile')}
              data-testid="nav-profile"
            >
              My Profile
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-40" data-testid="timeframe-select">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-slate-500">
              {data?.total_sessions || 0} session{data?.total_sessions !== 1 ? 's' : ''} analyzed
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={loadDevelopmentData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* No Data State - show when no sessions or data not loaded */}
        {(!data || data.total_sessions === 0) && !loading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Session Data Yet</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Once you have completed observation sessions, your development data and charts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : data && (
          <>
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Average Ball Rolling */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Avg. Ball Rolling</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {data?.average_ball_rolling || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Sessions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Sessions Observed</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {data?.total_sessions || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Interventions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Interventions</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {data?.intervention_breakdown?.reduce((sum, i) => sum + i.count, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Targets Progress Card */}
            {targetsData && targetsData.targets?.length > 0 && (
              <Card data-testid="targets-progress-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-['Manrope'] flex items-center gap-2">
                        <Target className="w-5 h-5 text-slate-600" />
                        Development Targets Progress
                      </CardTitle>
                      <CardDescription>
                        Track how your sessions align with your development goals
                      </CardDescription>
                    </div>
                    {targetsData.summary && (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-600">{targetsData.summary.achieved_targets}</p>
                          <p className="text-slate-500">Achieved</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{targetsData.summary.active_targets}</p>
                          <p className="text-slate-500">Active</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {targetsData.targets.map((target, index) => (
                      <div 
                        key={target.id || index}
                        className="p-4 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(target.status)}
                            <div className="flex-1">
                              <p className="text-slate-900 font-medium">{target.text}</p>
                              {target.progress_hint && (
                                <p className="text-sm text-slate-500 mt-1">
                                  {target.progress_hint}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getActivityBadge(target.activity_level)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {targetsData.summary?.dominant_style && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Coaching Style Insight:</span> Your most used intervention type is{' '}
                        <span className="font-semibold text-emerald-600">{targetsData.summary.dominant_style}</span>
                        {targetsData.summary.recent_sessions > 0 && (
                          <span> across {targetsData.summary.recent_sessions} recent session{targetsData.summary.recent_sessions !== 1 ? 's' : ''}</span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ball Rolling Over Time Chart */}
            {data?.sessions_over_time?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-600" />
                    Ball Rolling Over Time
                  </CardTitle>
                  <CardDescription>Track how your ball-in-play time changes across sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.sessions_over_time}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickFormatter={(value) => {
                            if (!value) return '';
                            const date = new Date(value);
                            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickFormatter={formatPercent}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                          formatter={(value) => [`${value}%`, 'Ball Rolling']}
                          labelFormatter={(value) => {
                            if (!value) return '';
                            const date = new Date(value);
                            return date.toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            });
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ball_rolling_pct"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#10b981' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Intervention Types Chart */}
            {data?.intervention_breakdown?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-slate-600" />
                    Intervention Types
                  </CardTitle>
                  <CardDescription>Distribution of your coaching interventions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bar Chart */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.intervention_breakdown} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            width={120}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: 'none',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {data.intervention_breakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={INTERVENTION_COLORS[index % INTERVENTION_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Pie Chart */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.intervention_breakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="name"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {data.intervention_breakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={INTERVENTION_COLORS[index % INTERVENTION_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: 'none',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Behavior Breakdowns - Content Focus */}
            {data?.behavior_breakdowns?.content_focus?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope']">Content Focus</CardTitle>
                  <CardDescription>What areas your interventions focus on</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.behavior_breakdowns.content_focus}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {data.behavior_breakdowns.content_focus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CONTENT_FOCUS_COLORS[index % CONTENT_FOCUS_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Behavior Breakdowns - Delivery Method */}
            {data?.behavior_breakdowns?.delivery_method?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope']">Delivery Method</CardTitle>
                  <CardDescription>How you deliver your coaching interventions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.behavior_breakdowns.delivery_method}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {data.behavior_breakdowns.delivery_method.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DELIVERY_METHOD_COLORS[index % DELIVERY_METHOD_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
