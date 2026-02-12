import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, ChevronRight, Loader2, Search, CloudOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { fetchCoachSessions } from '../lib/offlineApi';
import { useSync } from '../contexts/SyncContext';

export default function CoachSessions() {
  const navigate = useNavigate();
  const { online } = useSync();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCoachSessions();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load sessions');
      }
      
      setSessions(result.data || []);
      setFromCache(result.fromCache || false);
    } catch (err) {
      console.error('Sessions error:', err);
      setError(err.message || 'Failed to load sessions');
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

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title?.toLowerCase().includes(query) ||
      session.observer_name?.toLowerCase().includes(query) ||
      session.summary_preview?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 font-['Manrope']">My Sessions</h1>
          <p className="text-sm text-slate-500">Your observation sessions</p>
        </div>
        
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sessions List */}
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadSessions}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {searchQuery ? 'No sessions match your search' : 'No sessions recorded yet'}
              </p>
              {searchQuery && (
                <Button variant="outline" className="mt-4" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <Card 
                key={session.session_id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/coach/session/${session.session_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Title and Date */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-slate-900">
                          {session.title || 'Untitled Session'}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {formatDate(session.date)}
                        </Badge>
                      </div>
                      
                      {/* Observer */}
                      {session.observer_name && (
                        <p className="text-sm text-slate-500 mb-2">
                          Observed by: {session.observer_name}
                        </p>
                      )}
                      
                      {/* Summary Preview */}
                      {session.summary_preview && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {session.summary_preview}
                        </p>
                      )}
                      
                      {/* Status Badges */}
                      <div className="flex items-center gap-2 mt-3">
                        {session.has_observation && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            <FileText className="w-3 h-3 mr-1" />
                            Observed
                          </Badge>
                        )}
                        {session.has_reflection ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Reflected
                          </Badge>
                        ) : session.has_observation ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Awaiting Reflection
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-slate-400 ml-2 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Session Count */}
        {filteredSessions.length > 0 && (
          <p className="text-center text-sm text-slate-500 mt-6">
            Showing {filteredSessions.length} of {sessions.length} sessions
          </p>
        )}
      </main>
    </div>
  );
}
