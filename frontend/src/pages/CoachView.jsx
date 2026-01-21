import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Calendar, Target, Sparkles, Loader2, FileText, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { storage } from '../lib/storage';
import { formatDate, formatTime, calcPercentage } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function CoachView() {
  const navigate = useNavigate();
  const { coachId } = useParams();
  const { user } = useAuth();
  
  const [coach, setCoach] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    // Verify access - only allow if user is a coach linked to this profile or a coach developer
    if (user?.role === 'coach' && user?.linked_coach_id !== coachId) {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    const loadedCoach = storage.getCoach(coachId);
    if (!loadedCoach) {
      toast.error('Coach not found');
      navigate('/');
      return;
    }
    setCoach(loadedCoach);
    
    const coachSessions = storage.getCoachSessions(coachId)
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setSessions(coachSessions);
  }, [coachId, navigate, user]);

  if (!coach) return null;

  const activeTargets = (coach.targets || []).filter(t => t.status === 'active');
  const achievedTargets = (coach.targets || []).filter(t => t.status === 'achieved');

  // Calculate aggregate stats
  const totalSessions = sessions.length;
  const totalEvents = sessions.reduce((sum, s) => sum + (s.events?.length || 0), 0);
  const avgBallRolling = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => {
        const total = (s.ballRollingTime || 0) + (s.ballNotRollingTime || 0);
        return sum + (total > 0 ? (s.ballRollingTime / total) * 100 : 0);
      }, 0) / sessions.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')} 
              className="text-white hover:bg-white/20"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {coach.photoUrl ? (
                <img src={coach.photoUrl} alt={coach.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold font-['Manrope']">My Development</h1>
                <p className="text-sm text-green-100">{coach.name}</p>
              </div>
            </div>
          </div>
          <Badge className="bg-white/20 text-white hover:bg-white/20">
            Coach View
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="targets" data-testid="tab-targets">My Targets</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-slate-900">{totalSessions}</div>
                  <div className="text-sm text-slate-500">Sessions Observed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-slate-900">{totalEvents}</div>
                  <div className="text-sm text-slate-500">Total Interventions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{avgBallRolling}%</div>
                  <div className="text-sm text-slate-500">Avg Ball Rolling</div>
                </CardContent>
              </Card>
            </div>

            {/* Progress on Targets */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Development Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{achievedTargets.length} of {activeTargets.length + achievedTargets.length} targets achieved</span>
                    <span className="font-medium">{calcPercentage(achievedTargets.length, activeTargets.length + achievedTargets.length)}%</span>
                  </div>
                  <Progress 
                    value={calcPercentage(achievedTargets.length, activeTargets.length + achievedTargets.length)} 
                    className="h-3"
                  />
                </div>

                {activeTargets.length > 0 && (
                  <div className="mt-4">
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

            {/* AI Trends (if available) */}
            {coach.aiTrendSummary && (
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    Development Summary
                  </CardTitle>
                  <CardDescription>AI-generated analysis of your coaching patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate prose-sm max-w-none">
                    {coach.aiTrendSummary.split('\n').map((paragraph, i) => (
                      paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">My Observation Sessions</CardTitle>
                <CardDescription>View summaries and add your reflections</CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No completed sessions yet</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map(session => (
                      <div 
                        key={session.id}
                        className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/session/${session.id}/review`)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900">{session.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(session.createdAt)}
                              </span>
                              <span>•</span>
                              <span>{formatTime(session.totalDuration)}</span>
                              <span>•</span>
                              <span>{session.events?.length || 0} interventions</span>
                            </div>
                            {session.aiSummary && (
                              <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                {session.aiSummary.substring(0, 150)}...
                              </p>
                            )}
                          </div>
                          <Eye className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        </div>
                        
                        {/* Reflection indicator */}
                        <div className="flex gap-2 mt-3">
                          {(session.observerReflections?.length > 0) && (
                            <Badge variant="outline" className="text-xs">
                              {session.observerReflections.length} observer reflection(s)
                            </Badge>
                          )}
                          {(session.coachReflections?.length > 0) && (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                              {session.coachReflections.length} your reflection(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  My Development Targets
                </CardTitle>
                <CardDescription>Areas to focus on in your coaching practice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Active Targets */}
                <div>
                  <h4 className="font-medium text-slate-700 mb-3">Active Targets</h4>
                  {activeTargets.length === 0 ? (
                    <p className="text-slate-400 italic text-sm">No active targets set</p>
                  ) : (
                    <div className="space-y-2">
                      {activeTargets.map(target => (
                        <div key={target.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <p className="text-slate-700">{target.text}</p>
                          <p className="text-xs text-slate-400 mt-1">Set on {formatDate(target.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Achieved Targets */}
                {achievedTargets.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                      Achieved
                      <Badge className="bg-green-600">{achievedTargets.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {achievedTargets.map(target => (
                        <div key={target.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-slate-500 line-through">{target.text}</p>
                        </div>
                      ))}
                    </div>
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
