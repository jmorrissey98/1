import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Target, Calendar, ChevronRight, Loader2, CheckCircle, Clock, Plus, Trash2, AlertCircle, RefreshCw, WifiOff, Crown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { fetchCoaches, createCoach, deleteCoach } from '../lib/offlineApi';
import { isOnline, getPendingSyncCount } from '../lib/offlineSync';
import { safeGet } from '../lib/safeFetch';
import { useUpgrade } from '../contexts/UpgradeContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { SwipeablePageWrapper } from '../components/SwipeablePageWrapper';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function MyCoaches() {
  const navigate = useNavigate();
  const { openUpgradeModal } = useUpgrade();
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(isOnline());
  const [pendingSync, setPendingSync] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  
  // Subscription limits state
  const [limits, setLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);
  
  // Add Coach dialog state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachRole, setNewCoachRole] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete confirmation state
  const [coachToDelete, setCoachToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteUserToo, setDeleteUserToo] = useState(false);

  useEffect(() => {
    // Online/offline listener
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check pending sync count
    setPendingSync(getPendingSyncCount());
    
    loadCoaches();
    loadLimits();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadLimits = async () => {
    setLimitsLoading(true);
    try {
      const result = await safeGet(`${API_URL}/api/organization/limits`);
      if (result.ok) {
        setLimits(result.data);
      }
    } catch (err) {
      console.error('Failed to load limits:', err);
    } finally {
      setLimitsLoading(false);
    }
  };

  const loadCoaches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCoaches();
      
      if (!result.ok) {
        const errorMsg = result.data?.detail || result.error || 'Failed to load coaches';
        throw new Error(errorMsg);
      }
      
      setFromCache(result.fromCache || false);
      
      const coachesFromApi = result.data || [];
      setCoaches(coachesFromApi.map(coach => ({
        ...coach,
        activeTargets: (coach.targets || []).filter(t => t.status === 'active').length
      })));
    } catch (err) {
      console.error('Failed to load coaches:', err);
      setError(err.message || 'Failed to load coaches. Please try again.');
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoach = async () => {
    // Check subscription limit first
    if (limits && !limits.coaches.can_add) {
      toast.error(`Coach limit reached (${limits.coaches.current}/${limits.coaches.limit}). Please upgrade your subscription.`);
      return;
    }
    
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
      const result = await createCoach({
        name: newCoachName.trim(),
        email: newCoachEmail.trim(),
        role_title: newCoachRole.trim() || null
      });
      
      if (!result.ok) {
        // Get error message from API response
        const errorMsg = result.data?.detail || result.error || 'Failed to create coach';
        
        // Check if it's a limit error
        if (errorMsg.includes('limit reached') || result.status === 403) {
          toast.error(errorMsg);
          loadLimits(); // Refresh limits
          return;
        }
        throw new Error(errorMsg);
      }
      
      let successMsg;
      if (result.queued) {
        successMsg = `Coach "${newCoachName}" saved locally. Will sync when online.`;
        setPendingSync(getPendingSyncCount());
      } else {
        successMsg = result.data?.invite_sent 
          ? `Coach "${newCoachName}" added and invite sent!`
          : `Coach "${newCoachName}" added successfully`;
      }
      toast.success(successMsg);
      
      setShowAddCoach(false);
      setNewCoachName('');
      setNewCoachEmail('');
      setNewCoachRole('');
      await loadCoaches();
      await loadLimits(); // Refresh limits after adding
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
      const result = await deleteCoach(coachToDelete.id, deleteUserToo);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || result.error || 'Failed to delete coach');
      }
      
      let msg;
      if (result.queued) {
        msg = `Coach "${coachToDelete.name}" removed locally. Will sync when online.`;
      } else if (deleteUserToo) {
        msg = `Coach "${coachToDelete.name}" and their user account have been removed`;
      } else {
        msg = `Coach "${coachToDelete.name}" removed`;
      }
      toast.success(msg);
      
      if (result.queued) {
        setPendingSync(getPendingSyncCount());
      }
      
      setCoachToDelete(null);
      setDeleteUserToo(false);
      await loadCoaches();
      await loadLimits(); // Refresh limits after deleting
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

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await loadCoaches();
    await fetchLimits();
  }, []);

  return (
    <SwipeablePageWrapper>
      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-slate-50">
        {/* Offline/Sync Status Banner */}
        {(!online || fromCache || pendingSync > 0) && (
          <div className={`px-4 py-2 text-sm text-center ${!online ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
            {!online ? (
              <span className="flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4" />
                You're offline. Changes will sync when connected.
              </span>
            ) : pendingSync > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Syncing {pendingSync} pending changes...
              </span>
            ) : fromCache ? (
              <span>Showing cached data. Pull to refresh.</span>
            ) : null}
          </div>
        )}
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 font-['Manrope']">My Coaches</h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                Manage coach profiles and development
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Subscription Limit Indicator */}
            {limits && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-slate-500">Coaches:</span>
                <span className={`font-medium ${limits.coaches.can_add ? 'text-slate-700' : 'text-amber-600'}`}>
                  {limits.coaches.current}/{limits.coaches.limit}
                </span>
                {!limits.coaches.can_add && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-amber-600 hover:text-amber-700 h-7 px-2"
                    onClick={openUpgradeModal}
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                )}
              </div>
            )}
            
            {/* Add Coach Dialog */}
            <Dialog open={showAddCoach} onOpenChange={setShowAddCoach}>
              <DialogTrigger asChild>
                <Button 
                  data-testid="add-coach-btn"
                  size="sm"
                  className="px-2 sm:px-3"
                  disabled={limits && !limits.coaches.can_add}
                  title={limits && !limits.coaches.can_add ? `Coach limit reached (${limits.coaches.current}/${limits.coaches.limit})` : undefined}
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Coach</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Coach</DialogTitle>
                  <DialogDescription>
                    Create a coach profile. An invite will be sent automatically if they don't have an account.
                  </DialogDescription>
                </DialogHeader>
                
                {/* Limit warning in dialog */}
                {limits && (
                  <div className={`flex items-center justify-between p-3 rounded-lg ${limits.coaches.can_add ? 'bg-slate-50' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${limits.coaches.can_add ? 'text-slate-500' : 'text-amber-600'}`} />
                      <span className="text-sm">
                        Coach slots: <span className="font-medium">{limits.coaches.current}/{limits.coaches.limit}</span>
                      </span>
                    </div>
                    {!limits.coaches.can_add && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                        Limit reached
                      </Badge>
                    )}
                  </div>
                )}
                
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
                      disabled={limits && !limits.coaches.can_add}
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
                      disabled={limits && !limits.coaches.can_add}
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
                      disabled={limits && !limits.coaches.can_add}
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
      </div>
    </header>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!coachToDelete} onOpenChange={(open) => { if (!open) { setCoachToDelete(null); setDeleteUserToo(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Coach</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Are you sure you want to remove <strong>{coachToDelete?.name}</strong>?</p>
              
              {coachToDelete?.has_account && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={deleteUserToo}
                      onChange={(e) => setDeleteUserToo(e.target.checked)}
                      className="mt-1 rounded border-amber-300"
                    />
                    <div>
                      <p className="font-medium text-amber-900">Also delete their user account</p>
                      <p className="text-sm text-amber-700">
                        This coach has an active account. Check this box to fully remove them from the system. 
                        They won't be able to log in anymore.
                      </p>
                    </div>
                  </label>
                </div>
              )}
              
              {!coachToDelete?.has_account && (
                <p className="text-slate-500">This will delete their coach profile.</p>
              )}
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
              {deleteUserToo ? 'Remove Coach & Account' : 'Remove Coach'}
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
            {/* Coach List */}
            <div className="grid gap-4">
              {coaches.map((coach) => (
                <Card 
                  key={coach.id} 
                  className={`hover:shadow-md transition-shadow ${coach._pending ? 'border-amber-300 bg-amber-50/30' : ''}`}
                  data-testid={`coach-card-${coach.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => !coach._pending && navigate(`/coaches/${coach.id}`)}
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarImage 
                            src={coach.photo && !coach.photo.includes('undefined') ? coach.photo : undefined} 
                            alt={coach.name} 
                          />
                          <AvatarFallback className="bg-slate-200 text-slate-600">
                            {coach.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 font-['Manrope']">
                              {coach.name}
                            </h3>
                            {coach._pending ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                <WifiOff className="w-3 h-3 mr-1" />
                                Pending Sync
                              </Badge>
                            ) : coach.has_account ? (
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
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex flex-col items-center text-slate-600" title="Completed sessions">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs">{coach.sessionCount || 0}</span>
                            <span className="text-[10px] text-slate-400">Sessions</span>
                          </div>
                          {(coach.upcomingCount || 0) > 0 && (
                            <div className="flex flex-col items-center" title="Upcoming planned sessions">
                              <Clock className="w-4 h-4 text-blue-600" />
                              <span className="text-xs text-blue-600">{coach.upcomingCount}</span>
                              <span className="text-[10px] text-blue-400">Upcoming</span>
                            </div>
                          )}
                          {coach.activeTargets > 0 && (
                            <div className="flex flex-col items-center text-orange-600" title="Active targets">
                              <Target className="w-4 h-4" />
                              <span className="text-xs">{coach.activeTargets}</span>
                              <span className="text-[10px] text-orange-400">Targets</span>
                            </div>
                          )}
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
      </PullToRefresh>
    </SwipeablePageWrapper>
  );
}
