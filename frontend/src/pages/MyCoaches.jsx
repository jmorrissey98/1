import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Target, Calendar, ChevronRight, Loader2, CheckCircle, Clock, Plus, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { safeGet, safePost, safeDelete } from '../lib/safeFetch';

const API_URL = '';

export default function MyCoaches() {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add Coach dialog state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachRole, setNewCoachRole] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete confirmation state
  const [coachToDelete, setCoachToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Clear ALL stale localStorage coach data - we now use API only
    try {
      // Remove all possible coach-related localStorage keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('coach') || key.includes('mcd_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        console.log('[MyCoaches] Clearing stale cache:', key);
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.error('Failed to clear stale coaches cache:', e);
    }
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/coaches`);
      
      if (!result.ok) {
        // Check for specific error types
        const errorMsg = result.data?.detail || result.error || 'Failed to load coaches';
        if (errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504')) {
          throw new Error('Server is temporarily unavailable. Please try again in a moment.');
        }
        throw new Error(errorMsg);
      }
      
      // Use only API data - no localStorage enrichment that might cause issues
      const coachesFromApi = result.data || [];
      setCoaches(coachesFromApi.map(coach => ({
        ...coach,
        activeTargets: (coach.targets || []).filter(t => t.status === 'active').length
      })));
    } catch (err) {
      console.error('Failed to load coaches:', err);
      setError(err.message || 'Failed to load coaches. Please try again.');
      setCoaches([]); // Clear any stale data on error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoach = async () => {
    if (!newCoachName.trim()) {
      toast.error('Please enter a coach name');
      return;
    }
    
    if (!newCoachEmail.trim()) {
      toast.error('Please enter a coach email');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCoachEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const result = await safePost(`${API_URL}/api/coaches`, {
        name: newCoachName.trim(),
        email: newCoachEmail.trim(),
        role_title: newCoachRole.trim() || null
      });
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to create coach');
      }
      
      const successMsg = result.data?.invite_sent 
        ? `Coach "${newCoachName}" added and invite sent!`
        : `Coach "${newCoachName}" added successfully`;
      toast.success(successMsg);
      
      setShowAddCoach(false);
      setNewCoachName('');
      setNewCoachEmail('');
      setNewCoachRole('');
      await loadCoaches();
    } catch (err) {
      toast.error(err.message || 'Failed to create coach');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCoach = async () => {
    if (!coachToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const result = await safeDelete(`${API_URL}/api/coaches/${coachToDelete.id}`);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to delete coach');
      }
      
      toast.success(`Coach "${coachToDelete.name}" removed`);
      setCoachToDelete(null);
      await loadCoaches();
    } catch (err) {
      toast.error(err.message || 'Failed to delete coach');
    } finally {
      setIsDeleting(false);
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
                Manage coach profiles and development
              </p>
            </div>
          </div>
          
          {/* Add Coach Dialog */}
          <Dialog open={showAddCoach} onOpenChange={setShowAddCoach}>
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
                  Create a coach profile. An invite will be sent automatically if they don't have an account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="coach-name">Name *</Label>
                  <Input
                    id="coach-name"
                    value={newCoachName}
                    onChange={(e) => setNewCoachName(e.target.value)}
                    placeholder="Enter coach name"
                    className="mt-1"
                    data-testid="coach-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="coach-email">Email *</Label>
                  <Input
                    id="coach-email"
                    type="email"
                    value={newCoachEmail}
                    onChange={(e) => setNewCoachEmail(e.target.value)}
                    placeholder="coach@example.com"
                    className="mt-1"
                    data-testid="coach-email-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    An invite will be sent to this email if they don't have an account
                  </p>
                </div>
                <div>
                  <Label htmlFor="coach-role">Role / Title</Label>
                  <Input
                    id="coach-role"
                    value={newCoachRole}
                    onChange={(e) => setNewCoachRole(e.target.value)}
                    placeholder="e.g., Head Coach U16s"
                    className="mt-1"
                    data-testid="coach-role-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddCoach(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCoach} 
                  disabled={isCreating || !newCoachName.trim() || !newCoachEmail.trim()}
                  data-testid="create-coach-btn"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Add Coach
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!coachToDelete} onOpenChange={(open) => !open && setCoachToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Coach</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{coachToDelete?.name}</strong>? 
              This will delete their coach profile. Their user account (if they have one) will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCoach}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">Something went wrong</h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">{error}</p>
              <Button onClick={loadCoaches}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : coaches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">No coaches yet</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Add coaches to start tracking their development. They'll receive an invite email to create an account.
              </p>
              <Button onClick={() => setShowAddCoach(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Coach
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p>
                <strong>Tip:</strong> When you add a coach, they automatically receive an invite email.
                Once they sign up, their status changes from "Pending" to "Active".
              </p>
            </div>
            
            {/* Coach List */}
            <div className="grid gap-4">
              {coaches.map((coach) => (
                <Card 
                  key={coach.id} 
                  className="hover:shadow-md transition-shadow"
                  data-testid={`coach-card-${coach.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => navigate(`/coaches/${coach.id}`)}
                      >
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
                          {coach.email && (
                            <p className="text-xs text-slate-400">{coach.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-slate-600" title="Completed sessions">
                              <Calendar className="w-4 h-4" />
                              <span>{coach.sessionCount || 0}</span>
                            </div>
                            {(coach.upcomingCount || 0) > 0 && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200" title="Upcoming planned sessions">
                                <Clock className="w-3 h-3 mr-1" />
                                {coach.upcomingCount}
                              </Badge>
                            )}
                            {coach.activeTargets > 0 && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                <Target className="w-3 h-3 mr-1" />
                                {coach.activeTargets}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCoachToDelete(coach);
                          }}
                          data-testid={`delete-coach-${coach.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight 
                          className="w-5 h-5 text-slate-400 cursor-pointer" 
                          onClick={() => navigate(`/coaches/${coach.id}`)}
                        />
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
