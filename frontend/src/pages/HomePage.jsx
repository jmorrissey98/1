import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Eye, Trash2, Settings, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { storage } from '../lib/storage';
import { formatDate, formatTime } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setSessions(storage.getSessions().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  }, []);

  const handleDelete = (sessionId) => {
    storage.deleteSession(sessionId);
    setSessions(storage.getSessions().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-orange-500 hover:bg-orange-500">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-600 hover:bg-green-600">Completed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-['Manrope']" data-testid="app-title">
              My Coach Developer
            </h1>
            <p className="text-sm text-slate-500">Coach Observation Tool</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/templates')}
            data-testid="manage-templates-btn"
          >
            <Settings className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Create New Session */}
        <Card 
          className="mb-8 cursor-pointer hover:border-slate-400 transition-colors group"
          onClick={() => navigate('/session/new')}
          data-testid="create-session-card"
        >
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-slate-200 transition-colors">
                <Plus className="w-8 h-8 text-slate-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 font-['Manrope']">New Observation Session</h2>
              <p className="text-sm text-slate-500 mt-1">Start observing a coaching session</p>
            </div>
          </CardContent>
        </Card>

        {/* Sessions List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 font-['Manrope']">
            Your Sessions
          </h2>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No sessions yet. Create your first observation session above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow" data-testid={`session-card-${session.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-['Manrope']">{session.name}</CardTitle>
                        <CardDescription>{formatDate(session.createdAt)}</CardDescription>
                      </div>
                      {getStatusBadge(session.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                      <span>{session.events?.length || 0} events</span>
                      <span>•</span>
                      <span>{formatTime(session.totalDuration || 0)} duration</span>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'draft' && (
                        <Button 
                          size="sm" 
                          onClick={() => navigate(`/session/${session.id}/setup`)}
                          data-testid={`edit-session-${session.id}`}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Setup
                        </Button>
                      )}
                      {(session.status === 'draft' || session.status === 'active') && (
                        <Button 
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => navigate(`/session/${session.id}/observe`)}
                          data-testid={`observe-session-${session.id}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {session.status === 'active' ? 'Resume' : 'Start'}
                        </Button>
                      )}
                      {session.status === 'completed' && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/session/${session.id}/review`)}
                          data-testid={`review-session-${session.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      )}
                      {session.events?.length > 0 && session.status !== 'completed' && (
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/session/${session.id}/review`)}
                          data-testid={`view-data-${session.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Data
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{session.name}" and all its data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(session.id)}
                              className="bg-red-600 hover:bg-red-700"
                              data-testid={`confirm-delete-${session.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
