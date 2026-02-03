import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Target, Calendar, FileText, ChevronRight, AlertCircle, CheckCircle2, Clock, Loader2, CloudOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { fetchCoachDashboard } from '../lib/offlineApi';
import { useSync } from '../contexts/SyncContext';

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { online } = useSync();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCoachDashboard();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load dashboard');
      }
      
      setDashboard(result.data);
      setFromCache(result.fromCache || false);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getTargetStatusColor = (status) => {
    switch (status) {
      case 'achieved': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTargetStatusIcon = (status) => {
    switch (status) {
      case 'achieved': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <Target className="w-4 h-4 text-blue-600" />;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { profile, targets, upcoming_observations, recent_session, has_pending_reflection, pending_reflection_session_id } = dashboard || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">Dashboard</h1>
              <p className="text-sm text-slate-500">Your coaching overview</p>
            </div>
            {(!online || fromCache) && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <CloudOff className="w-4 h-4" />
                <span>{!online ? 'Offline' : 'Cached'}</span>
              </div>
            )}
          </div>
          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4 -mb-4 border-b-0">
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-emerald-600 text-emerald-700 font-medium"
              data-testid="nav-dashboard"
            >
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach/development')}
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Profile Summary - Simplified without Edit button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.photo} alt={profile?.name} />
                <AvatarFallback className="bg-slate-200 text-slate-600 text-lg">
                  {profile?.name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">{profile?.name}</h2>
                {profile?.role_title && (
                  <p className="text-slate-600">{profile.role_title}</p>
                )}
                {(profile?.age_group || profile?.department) && (
                  <p className="text-sm text-slate-500">
                    {[profile.age_group, profile.department].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reflection Prompt */}
        {has_pending_reflection && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className="font-medium text-amber-800">Time for reflection</span>
                <p className="text-amber-700 text-sm mt-1">
                  You have a recent session that's waiting for your thoughts. Taking a moment to reflect can deepen your learning.
                </p>
              </div>
              <Button 
                size="sm" 
                className="ml-4 bg-amber-600 hover:bg-amber-700"
                onClick={() => navigate(`/coach/session/${pending_reflection_session_id}`)}
              >
                Add Reflection
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* My Targets */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-slate-600" />
                  My Targets
                </CardTitle>
                <CardDescription>Your current development focus areas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {targets && targets.length > 0 ? (
              <div className="space-y-3">
                {targets.map((target, index) => (
                  <div 
                    key={target.id || index} 
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    {getTargetStatusIcon(target.status)}
                    <div className="flex-1">
                      <p className="text-slate-900">{target.text}</p>
                      {target.assigned_by && (
                        <p className="text-xs text-slate-500 mt-1">
                          Set by {target.assigned_by}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={getTargetStatusColor(target.status)}>
                      {target.status === 'in_progress' ? 'In Progress' : 
                       target.status === 'achieved' ? 'Achieved' : 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">
                No active targets yet. Targets will appear here when assigned or identified through observations.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Observations */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              Upcoming Observations
            </CardTitle>
            <CardDescription>Scheduled sessions with observers</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming_observations && upcoming_observations.length > 0 ? (
              <div className="space-y-3">
                {upcoming_observations.map((obs) => (
                  <div 
                    key={obs.schedule_id} 
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatDate(obs.scheduled_date)}
                        </p>
                        <p className="text-sm text-slate-500">
                          Observer: {obs.observer_name || 'TBC'}
                        </p>
                      </div>
                    </div>
                    {obs.session_context && (
                      <Badge variant="outline">{obs.session_context}</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">
                No upcoming observations scheduled
              </p>
            )}
          </CardContent>
        </Card>

        {/* Most Recent Session */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              Most Recent Session
            </CardTitle>
            <CardDescription>Your latest observed session</CardDescription>
          </CardHeader>
          <CardContent>
            {recent_session ? (
              <div 
                className="p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => navigate(`/coach/session/${recent_session.session_id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-slate-900">
                        {recent_session.title || 'Session'}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {formatDate(recent_session.date || recent_session.createdAt)}
                      </Badge>
                    </div>
                    {recent_session.ai_summary && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {recent_session.ai_summary.substring(0, 200)}...
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 ml-2 flex-shrink-0" />
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">
                No sessions recorded yet
              </p>
            )}
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/coach/sessions')}
              >
                View All My Sessions
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
