import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, User, Target, Calendar, ChevronRight, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { storage, createCoach } from '../lib/storage';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function MyCoaches() {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [showNewCoach, setShowNewCoach] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachRole, setNewCoachRole] = useState('');
  const [newCoachEmail, setNewCoachEmail] = useState('');

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = () => {
    const allCoaches = storage.getCoaches();
    // Add session count to each coach
    const coachesWithStats = allCoaches.map(coach => ({
      ...coach,
      sessionCount: storage.getCoachSessions(coach.id).length,
      activeTargets: (coach.targets || []).filter(t => t.status === 'active').length
    }));
    setCoaches(coachesWithStats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  };

  const handleCreateCoach = async () => {
    if (!newCoachName.trim()) {
      toast.error('Please enter a coach name');
      return;
    }
    
    const coach = createCoach(newCoachName.trim());
    coach.role = newCoachRole.trim();
    coach.email = newCoachEmail.trim().toLowerCase();
    storage.saveCoach(coach);
    
    // If email provided, check if there's a user with that email and link them
    if (coach.email) {
      try {
        const response = await fetch(`${API_URL}/api/users/link-by-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: coach.email, coach_id: coach.id })
        });
        
        if (response.ok) {
          const text = await response.text();
          const data = text ? JSON.parse(text) : {};
          if (data.linked) {
            toast.success(`Coach profile created and linked to existing user account`);
          } else {
            toast.success('Coach profile created');
          }
        } else {
          toast.success('Coach profile created');
        }
      } catch (err) {
        console.error('Failed to link user:', err);
        toast.success('Coach profile created');
      }
    } else {
      toast.success('Coach profile created');
    }
    
    setNewCoachName('');
    setNewCoachRole('');
    setNewCoachEmail('');
    setShowNewCoach(false);
    loadCoaches();
    
    // Navigate to the new coach's profile
    navigate(`/coaches/${coach.id}`);
  };

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
              <p className="text-sm text-slate-500">Manage coach profiles and track development</p>
            </div>
          </div>
          <Dialog open={showNewCoach} onOpenChange={setShowNewCoach}>
            <DialogTrigger asChild>
              <Button data-testid="add-coach-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Coach
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Coach</DialogTitle>
                <DialogDescription>
                  Create a profile to track observations and development for this coach.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="coach-name">Coach Name</Label>
                  <Input
                    id="coach-name"
                    value={newCoachName}
                    onChange={(e) => setNewCoachName(e.target.value)}
                    placeholder="e.g., John Smith"
                    className="mt-1"
                    data-testid="new-coach-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="coach-email">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email Address
                  </Label>
                  <Input
                    id="coach-email"
                    type="email"
                    value={newCoachEmail}
                    onChange={(e) => setNewCoachEmail(e.target.value)}
                    placeholder="coach@example.com"
                    className="mt-1"
                    data-testid="new-coach-email-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    The coach can create an account with this email to view their observations
                  </p>
                </div>
                <div>
                  <Label htmlFor="coach-role">Role (optional)</Label>
                  <Input
                    id="coach-role"
                    value={newCoachRole}
                    onChange={(e) => setNewCoachRole(e.target.value)}
                    placeholder="e.g., U14 Head Coach"
                    className="mt-1"
                    data-testid="new-coach-role-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewCoach(false)}>Cancel</Button>
                <Button onClick={handleCreateCoach} data-testid="create-coach-btn">Create Profile</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {coaches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No coach profiles yet.</p>
              <Button onClick={() => setShowNewCoach(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Coach
              </Button>
            </CardContent>
          </Card>
        ) : (
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
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 font-['Manrope']">{coach.name}</h3>
                        {coach.role && (
                          <p className="text-sm text-slate-500">{coach.role}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Calendar className="w-4 h-4" />
                            <span>{coach.sessionCount} sessions</span>
                          </div>
                          {coach.activeTargets > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              <Target className="w-3 h-3 mr-1" />
                              {coach.activeTargets} targets
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
