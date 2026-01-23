import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Target, Calendar, ChevronRight, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { safeGet } from '../lib/safeFetch';
import { storage } from '../lib/storage';

const API_URL = '';

export default function MyCoaches() {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/coaches`);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to load coaches');
      }
      
      // Enrich with session count from local storage (sessions are stored locally)
      const coachesWithStats = (result.data || []).map(coach => ({
        ...coach,
        sessionCount: storage.getCoachSessions(coach.id).length,
        activeTargets: (coach.targets || []).filter(t => t.status === 'active').length
      }));
      
      setCoaches(coachesWithStats);
    } catch (err) {
      console.error('Failed to load coaches:', err);
      setError(err.message || 'Failed to load coaches');
      toast.error('Failed to load coaches');
    } finally {
      setLoading(false);
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
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">My Coaches</h1>
              <p className="text-sm text-slate-500">
                Coaches who have signed up appear automatically
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/settings')} data-testid="invite-coach-btn">
            Invite Coach
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button variant="outline" onClick={loadCoaches}>Try Again</Button>
            </CardContent>
          </Card>
        ) : coaches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">No coaches yet</h3>
              <p className="text-slate-500 mb-4 max-w-md mx-auto">
                When you invite someone as a Coach and they sign up, they'll automatically appear here.
              </p>
              <Button onClick={() => navigate('/settings')}>
                Go to Settings to Invite
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p>
                <strong>Coaches appear automatically</strong> when they accept your invite and create an account.
                Use Settings → Invite to add new coaches.
              </p>
            </div>
            
            {/* Coach List */}
            <div className="grid gap-4">
              {coaches.map((coach) => (
                <Card 
                  key={coach.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/coaches/${coach.id}`)}
                  data-testid={`coach-card-${coach.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={coach.photo} alt={coach.name} />
                          <AvatarFallback className="bg-slate-200 text-slate-600">
                            {coach.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 font-['Manrope']">
                              {coach.name}
                            </h3>
                            {coach.has_account ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          {coach.role_title && (
                            <p className="text-sm text-slate-500">{coach.role_title}</p>
                          )}
                          {(coach.age_group || coach.department) && (
                            <p className="text-xs text-slate-400">
                              {[coach.age_group, coach.department].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-4 h-4" />
                              <span>{coach.sessionCount || 0} sessions</span>
                            </div>
                            {coach.activeTargets > 0 && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                <Target className="w-3 h-3 mr-1" />
                                {coach.activeTargets} targets
                              </Badge>
                            )}
                          </div>
                          {coach.created_at && (
                            <p className="text-xs text-slate-400 mt-1">
                              Joined {formatDate(coach.created_at)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
