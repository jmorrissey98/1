import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Shield, UserPlus, Trash2, LogOut, Loader2, Send, Building2, Upload, X, Database, Crown, AlertCircle, CreditCard, Calendar, ExternalLink, ChevronDown, ChevronUp, TrendingUp, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useUpgrade } from '../contexts/UpgradeContext';
import { storage } from '../lib/storage';
import { safeGet, safePost, safeDelete, safePut } from '../lib/safeFetch';
import { fetchCoaches } from '../lib/offlineApi';
import { fetchLimitsSummary } from '../lib/subscriptionApi';
import { SwipeablePageWrapper } from '../components/SwipeablePageWrapper';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user, logout, isCoachDeveloper } = useAuth();
  const { organization, updateOrganization, refreshOrganization } = useOrganization();
  const { openUpgradeModal } = useUpgrade();
  const API_URL = ''; // Relative URL - frontend and backend on same domain
  
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  const [showUpgradeTooltip, setShowUpgradeTooltip] = useState(false);
  
  // Subscription limits state
  const [limits, setLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);
  
  // Subscription status state
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');  // Add name field
  const [inviteRole, setInviteRole] = useState('coach');
  const [inviteCoachId, setInviteCoachId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteFormExpanded, setInviteFormExpanded] = useState(false);  // Collapsible state
  
  // Club settings state
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState('');
  const [savingClub, setSavingClub] = useState(false);

  useEffect(() => {
    loadData();
    loadLimits();
    if (isCoachDeveloper()) {
      loadSubscriptionStatus();
    }
  }, []);
  
  const loadLimits = async () => {
    setLimitsLoading(true);
    try {
      // Use new subscription limits-summary API (Phase 5)
      const result = await fetchLimitsSummary();
      if (result.ok && result.data) {
        // Transform the new format to be compatible with existing UI
        const newLimits = result.data;
        setLimits({
          tier_key: newLimits.tier_key,
          tier_name: newLimits.tier_name,
          is_legacy: newLimits.is_legacy,
          coaches: {
            current: newLimits.coaches?.current || 0,
            limit: newLimits.coaches?.limit || 'Unlimited',
            can_add: newLimits.coaches?.can_add !== false,
            is_unlimited: newLimits.coaches?.is_unlimited || false
          },
          admins: {
            current: newLimits.coach_developers?.current || 0,
            limit: newLimits.coach_developers?.limit || 1,
            can_add: newLimits.coach_developers?.can_add !== false,
            is_unlimited: newLimits.coach_developers?.is_unlimited || false
          },
          observations_per_coach: {
            limit: newLimits.observations_per_coach?.limit,
            is_unlimited: newLimits.observations_per_coach?.is_unlimited || false
          },
          features: newLimits.features || {}
        });
      } else {
        // Fallback to old API
        const fallbackResult = await safeGet(`${API_URL}/api/organization/limits`);
        if (fallbackResult.ok) {
          setLimits(fallbackResult.data);
        }
      }
    } catch (err) {
      console.error('Failed to load limits:', err);
    } finally {
      setLimitsLoading(false);
    }
  };
  
  const loadSubscriptionStatus = async () => {
    try {
      const result = await safeGet(`${API_URL}/api/payments/subscription-status`);
      if (result.ok) {
        setSubscriptionStatus(result.data);
      }
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    }
  };
  
  // Always open the upgrade modal instead of going directly to Stripe
  const handleManageSubscription = () => {
    openUpgradeModal();
  };
  
  useEffect(() => {
    if (organization) {
      setClubName(organization.club_name || '');
      setClubLogo(organization.club_logo || '');
    }
  }, [organization]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isCoachDeveloper()) {
        // Load subscription tier
        try {
          const subResult = await safeGet(`${API_URL}/api/organization/subscription`);
          if (subResult.ok && subResult.data) {
            setSubscriptionTier(subResult.data.tier || 'individual');
          }
        } catch (e) {
          console.error('Failed to load subscription:', e);
        }
        
        // Load coaches with offline support
        try {
          const coachesResult = await fetchCoaches();
          if (coachesResult.ok && coachesResult.data) {
            setCoaches(coachesResult.data);
          }
        } catch (e) {
          console.error('Failed to load coaches:', e);
        }
        
        // Load users from backend
        try {
          const usersResult = await safeGet(`${API_URL}/api/users`);
          if (usersResult.ok && usersResult.data) {
            setUsers(usersResult.data);
          }
        } catch (e) {
          console.error('Failed to load users:', e);
        }
        
        // Load invites from backend
        try {
          const invitesResult = await safeGet(`${API_URL}/api/invites`);
          if (invitesResult.ok && invitesResult.data) {
            setInvites(invitesResult.data);
          }
        } catch (e) {
          console.error('Failed to load invites:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    if (!inviteName.trim()) {
      toast.error('Please enter the invitee\'s name');
      return;
    }
    
    // Check subscription limits before sending
    if (limits) {
      if (inviteRole === 'coach' && !limits.coaches.can_add) {
        toast.error(`Coach limit reached (${limits.coaches.current}/${limits.coaches.limit}). Please upgrade your subscription.`);
        return;
      }
      if (inviteRole === 'coach_developer' && !limits.admins.can_add) {
        toast.error(`Admin limit reached (${limits.admins.current}/${limits.admins.limit}). Please upgrade your subscription.`);
        return;
      }
    }

    setInviting(true);
    try {
      const result = await safePost(`${API_URL}/api/invites`, {
        email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim(),  // Pass the name
        role: inviteRole,
        coach_id: inviteRole === 'coach' && inviteCoachId && inviteCoachId !== 'none' ? inviteCoachId : null
      });
      
      if (result.networkError) {
        toast.error('Network error. Please check your connection.');
        return;
      }
      
      if (!result.ok) {
        // Show the specific error from the server
        const errorMsg = result.data?.detail || `Failed to send invite (${result.status})`;
        toast.error(errorMsg);
        return;
      }

      toast.success(`Invite sent to ${inviteEmail}${result.data?.email_sent === false ? ' (email delivery pending)' : ''}`);
      setInviteEmail('');
      setInviteName('');  // Clear name field
      setInviteCoachId('');
      await loadData();
      await loadLimits(); // Refresh limits after sending invite
    } catch (err) {
      console.error('Invite error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteInvite = async (inviteId) => {
    try {
      const result = await safeDelete(`${API_URL}/api/invites/${inviteId}`);

      if (!result.ok) {
        throw new Error('Failed to delete invite');
      }

      toast.success('Invite deleted');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete invite');
    }
  };

  const handleResendInvite = async (inviteId, email) => {
    try {
      const result = await safePost(`${API_URL}/api/invites/${inviteId}/resend`, {});
      
      if (result.networkError) {
        toast.error(result.data?.detail || 'Unable to connect. Please try again.');
        return;
      }
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to resend invite');
      }

      toast.success(`Invite email resent to ${email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to resend invite');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const result = await safePut(`${API_URL}/api/users/${userId}/role`, { user_id: userId, new_role: newRole });
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to update role');
      }

      toast.success('Role updated');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    try {
      const result = await safeDelete(`${API_URL}/api/users/${userId}`);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to delete user');
      }

      toast.success(`${userName} has been removed`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getCoachName = (coachId) => {
    const coach = coaches.find(c => c.id === coachId);
    return coach?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <SwipeablePageWrapper>
      <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope']">Settings</h1>
              <p className="text-xs sm:text-sm text-slate-500">Manage your account and team</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Current User Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Your Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {user?.picture && (
                <img 
                  src={user.picture} 
                  alt={user.name} 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-lg">{user?.name}</p>
                <p className="text-slate-500">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={
                    user?.role === 'admin' 
                      ? 'bg-green-100 text-green-800' 
                      : user?.role === 'coach_developer' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                  }>
                    {user?.role === 'admin' ? 'Admin' : user?.role === 'coach_developer' ? 'Coach Developer' : 'Coach'}
                  </Badge>
                  
                  {/* Subscription Tier Badge (Coach Developer only) */}
                  {isCoachDeveloper() && subscriptionTier && (
                    <div className="relative">
                      <Badge 
                        className={`cursor-pointer transition-all ${
                          subscriptionTier === 'club' 
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                            : subscriptionTier === 'developer'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                        }`}
                        onClick={() => subscriptionTier !== 'club' && setShowUpgradeTooltip(!showUpgradeTooltip)}
                        data-testid="subscription-badge"
                      >
                        {subscriptionTier === 'club' ? 'Club Plan' : 
                         subscriptionTier === 'developer' ? 'Developer Plan' : 
                         'Individual Plan'}
                      </Badge>
                      
                      {/* Upgrade Tooltip */}
                      {showUpgradeTooltip && subscriptionTier !== 'club' && (
                        <div className="absolute top-full left-0 mt-2 z-10 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[180px]">
                          <p className="text-sm text-slate-600 mb-2">
                            {subscriptionTier === 'individual' 
                              ? 'Upgrade for more coaches and features'
                              : 'Upgrade to Club for unlimited access'}
                          </p>
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={() => {
                              setShowUpgradeTooltip(false);
                              openUpgradeModal();
                            }}
                            data-testid="upgrade-btn"
                          >
                            Upgrade Plan
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Developer Only: Team Management */}
        {isCoachDeveloper() && (
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="club" data-testid="tab-club">
                <Building2 className="w-4 h-4 mr-2" />
                Club
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              {/* Collapsible Invite New User Section */}
              <Collapsible open={inviteFormExpanded} onOpenChange={setInviteFormExpanded}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-['Manrope'] flex items-center gap-2">
                            <UserPlus className="w-5 h-5" />
                            Invite New User
                          </CardTitle>
                          <CardDescription>
                            Send an invite to allow someone to create an account
                          </CardDescription>
                        </div>
                        {inviteFormExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {/* Subscription Limits Summary - Phase 5 Enhanced */}
                      {limits && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          {/* Tier Header */}
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-slate-700 flex items-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              Subscription Usage
                            </h4>
                            <Badge variant="outline" className="capitalize">
                              {limits.tier_name || limits.tier_key || 'Unknown'}
                              {limits.is_legacy && <span className="ml-1 text-xs">(Legacy)</span>}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Coaches Usage */}
                            <div className={`p-3 rounded-lg ${limits.coaches.can_add ? 'bg-white' : 'bg-amber-50 border border-amber-200'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Coaches</span>
                                <span className={`font-semibold ${limits.coaches.can_add ? 'text-slate-700' : 'text-amber-600'}`}>
                                  {limits.coaches.is_unlimited ? (
                                    <span className="text-green-600">Unlimited</span>
                                  ) : (
                                    `${limits.coaches.current}/${limits.coaches.limit}`
                                  )}
                                </span>
                              </div>
                              {!limits.coaches.can_add && !limits.coaches.is_unlimited && (
                                <p className="text-xs text-amber-600 mt-1">Limit reached</p>
                              )}
                            </div>
                            
                            {/* Coach Developers Usage */}
                            <div className={`p-3 rounded-lg ${limits.admins.can_add ? 'bg-white' : 'bg-amber-50 border border-amber-200'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Coach Developers</span>
                                <span className={`font-semibold ${limits.admins.can_add ? 'text-slate-700' : 'text-amber-600'}`}>
                                  {limits.admins.current}/{limits.admins.limit}
                                </span>
                              </div>
                              {!limits.admins.can_add && (
                                <p className="text-xs text-amber-600 mt-1">Limit reached</p>
                              )}
                            </div>
                            
                            {/* Observations Per Coach - Phase 5 New */}
                            <div className="p-3 rounded-lg bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  Obs/Coach
                                </span>
                                <span className="font-semibold text-slate-700">
                                  {limits.observations_per_coach?.is_unlimited ? (
                                    <span className="text-green-600">Unlimited</span>
                                  ) : (
                                    `${limits.observations_per_coach?.limit || 10}`
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {limits.observations_per_coach?.is_unlimited 
                                  ? 'No limit on observations' 
                                  : 'Per coach limit'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Features Info */}
                          {limits.features && (
                            <div className="mt-4 pt-3 border-t border-slate-200">
                              <div className="flex flex-wrap gap-2 text-xs">
                                {limits.features.history_access === 'unlimited' && (
                                  <Badge variant="secondary" className="bg-green-50 text-green-700">
                                    Unlimited History
                                  </Badge>
                                )}
                                {limits.features.data_retention_months && (
                                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                    {limits.features.data_retention_months}mo Data Retention
                                  </Badge>
                                )}
                                {limits.features.self_observation && (
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                                    Self Observation
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Upgrade prompt if any limit reached */}
                          {(!limits.coaches.can_add || !limits.admins.can_add) && (
                            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                              <p className="text-sm text-slate-600">
                                Need more capacity?
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openUpgradeModal()}
                                data-testid="upgrade-limits-btn"
                              >
                                <Crown className="w-3 h-3 mr-1" />
                                Upgrade Plan
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {limitsLoading && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                          <span className="ml-2 text-sm text-slate-500">Loading subscription info...</span>
                        </div>
                      )}
                      
                      <form onSubmit={handleCreateInvite} className="space-y-4">
                        <div>
                          <Label htmlFor="invite-name">Full Name *</Label>
                          <Input
                            id="invite-name"
                            type="text"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            placeholder="Enter invitee's full name"
                            className="mt-1"
                            data-testid="invite-name-input"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="invite-email">Email Address *</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="coach@example.com"
                            className="mt-1"
                            data-testid="invite-email-input"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="invite-role">Role</Label>
                          <Select 
                            value={inviteRole} 
                            onValueChange={(val) => {
                              // Prevent selecting coach_developer if limit reached
                              if (val === 'coach_developer' && limits && !limits.admins.can_add) {
                                toast.error(`Admin limit reached (${limits.admins.current}/${limits.admins.limit}). Please upgrade your subscription.`);
                                return;
                              }
                              // Prevent selecting coach if limit reached
                              if (val === 'coach' && limits && !limits.coaches.can_add) {
                                toast.error(`Coach limit reached (${limits.coaches.current}/${limits.coaches.limit}). Please upgrade your subscription.`);
                                return;
                              }
                              setInviteRole(val);
                            }}
                          >
                            <SelectTrigger className="mt-1" data-testid="invite-role-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem 
                                value="coach" 
                                disabled={limits && !limits.coaches.can_add}
                              >
                                Coach {limits && !limits.coaches.can_add && '(Limit reached)'}
                              </SelectItem>
                              <SelectItem 
                                value="coach_developer"
                                disabled={limits && !limits.admins.can_add}
                              >
                                Coach Developer {limits && !limits.admins.can_add && '(Limit reached)'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {/* Warning if selected role limit is reached */}
                          {limits && inviteRole === 'coach' && !limits.coaches.can_add && (
                            <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              <span>Coach limit reached. Upgrade to invite more coaches.</span>
                            </div>
                          )}
                          {limits && inviteRole === 'coach_developer' && !limits.admins.can_add && (
                            <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              <span>Admin limit reached. Upgrade to invite more admins.</span>
                            </div>
                          )}
                        </div>

                        {inviteRole === 'coach' && coaches.length > 0 && (
                          <div>
                            <Label htmlFor="invite-coach">Link to Coach Profile (Optional)</Label>
                            <Select value={inviteCoachId} onValueChange={setInviteCoachId}>
                              <SelectTrigger className="mt-1" data-testid="invite-coach-select">
                                <SelectValue placeholder="Select a coach profile..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No profile</SelectItem>
                                {coaches.map(coach => (
                                  <SelectItem key={coach.id} value={coach.id}>
                                    {coach.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-1">
                              If selected, the user will automatically be linked to this coach profile
                            </p>
                          </div>
                        )}

                        <Button 
                          type="submit" 
                          disabled={
                            inviting || 
                            (limits && inviteRole === 'coach' && !limits.coaches.can_add) ||
                            (limits && inviteRole === 'coach_developer' && !limits.admins.can_add)
                          } 
                          data-testid="send-invite-btn"
                        >
                          {inviting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4 mr-2" />
                          )}
                          Send Invite
                        </Button>
                      </form>

                      {/* Pending Invites */}
                      {invites.length > 0 && (
                        <div className="mt-6 border-t pt-6">
                          <h4 className="font-medium text-slate-700 mb-3">Pending Invites</h4>
                          <div className="space-y-2">
                            {invites.map(invite => (
                              <div key={invite.invite_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div>
                                  <p className="font-medium">{invite.email}</p>
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Badge variant="outline">
                                      {invite.role === 'coach_developer' ? 'Coach Developer' : 'Coach'}
                                    </Badge>
                                    {invite.coach_id && (
                                      <span>→ {getCoachName(invite.coach_id)}</span>
                                    )}
                                    {invite.email_sent === false && (
                                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                                        Email pending
                                      </Badge>
                                    )}
                                    {invite.email_sent === true && (
                                      <Badge variant="outline" className="text-green-600 border-green-300">
                                        Email sent
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleResendInvite(invite.invite_id, invite.email)}
                                    title="Resend invite email"
                                  >
                                    <Send className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Invite?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will revoke the invite for {invite.email}.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteInvite(invite.invite_id)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Team Members Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    Manage user roles and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No users yet</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map(u => (
                        <div key={u.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {u.picture && (
                              <img src={u.picture} alt={u.name} className="w-10 h-10 rounded-full" />
                            )}
                            <div>
                              <p className="font-medium">
                                {u.name}
                                {u.user_id === user?.user_id && (
                                  <span className="text-slate-500 text-sm ml-2">(You)</span>
                                )}
                              </p>
                              <p className="text-sm text-slate-500">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {u.user_id !== user?.user_id ? (
                              <>
                                <Select 
                                  value={u.role} 
                                  onValueChange={(newRole) => handleRoleChange(u.user_id, newRole)}
                                >
                                  <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="coach">Coach</SelectItem>
                                    <SelectItem value="coach_developer">Coach Developer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently remove {u.name} ({u.email}) from the system. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteUser(u.user_id, u.name)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            ) : (
                              <Badge className="bg-purple-100 text-purple-800">
                                Coach Developer
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

            {/* Club Tab */}
            <TabsContent value="club" className="space-y-6">
              {/* Subscription Management Card */}
              {subscriptionStatus?.has_subscription && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      Subscription Management
                    </CardTitle>
                    <CardDescription>
                      Manage your subscription plan and billing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Current Plan Info */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm text-slate-600">Current Plan</p>
                        <p className="font-semibold text-slate-900">
                          {subscriptionStatus.tier_name || subscriptionStatus.tier?.charAt(0).toUpperCase() + subscriptionStatus.tier?.slice(1) || 'Active'}
                        </p>
                      </div>
                      <Badge 
                        className={
                          subscriptionStatus.status === 'active' ? 'bg-green-100 text-green-700' :
                          subscriptionStatus.status === 'past_due' ? 'bg-amber-100 text-amber-700' :
                          subscriptionStatus.status === 'canceled' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }
                      >
                        {subscriptionStatus.status === 'active' ? 'Active' :
                         subscriptionStatus.status === 'past_due' ? 'Past Due' :
                         subscriptionStatus.status === 'canceled' ? 'Canceled' :
                         subscriptionStatus.status}
                      </Badge>
                    </div>
                    
                    {/* Plan Benefits */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium text-slate-700 mb-2">Your Plan Includes:</p>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span><strong>{subscriptionStatus.coaches_limit || limits?.coaches?.limit || 5}</strong> Coaches</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <UserPlus className="w-4 h-4 text-purple-500" />
                          <span><strong>{subscriptionStatus.admins_limit || limits?.admins?.limit || 1}</strong> Coach {(subscriptionStatus.admins_limit || limits?.admins?.limit || 1) === 1 ? 'Educator' : 'Educators'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Database className="w-4 h-4 text-green-500" />
                          <span>
                            {(subscriptionStatus.tier === 'individual' || subscriptionStatus.tier === 'free') 
                              ? <><strong>3 months</strong> data history</>
                              : <><strong>Unlimited</strong> data history</>
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Billing Period */}
                    {subscriptionStatus.current_period_end && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {subscriptionStatus.cancel_at_period_end 
                            ? `Cancels on ${new Date(subscriptionStatus.current_period_end).toLocaleDateString()}`
                            : `Renews on ${new Date(subscriptionStatus.current_period_end).toLocaleDateString()}`
                          }
                        </span>
                      </div>
                    )}
                    
                    {/* Warning for past due */}
                    {subscriptionStatus.status === 'past_due' && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Your payment is past due. Please update your payment method.
                      </div>
                    )}
                    
                    {/* Manage Subscription Button */}
                    <Button 
                      onClick={handleManageSubscription}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="manage-subscription-btn"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </Button>
                    
                    <p className="text-xs text-slate-500 text-center">
                      Change plan, update payment method, or view invoices
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {/* No subscription - show upgrade prompt */}
              {subscriptionStatus && !subscriptionStatus.has_subscription && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Subscription
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-600 mb-4">
                        Subscribe to a plan to unlock team management features.
                      </p>
                      <Button 
                        onClick={() => openUpgradeModal()}
                        data-testid="subscribe-btn"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        View Plans
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Club / Organization Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Club / Organization
                  </CardTitle>
                  <CardDescription>
                    Set your club name and logo. This will appear in the app header for all users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="club-name">Club Name</Label>
                    <Input
                      id="club-name"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      placeholder="e.g., Manchester United FC"
                      className="mt-1"
                      data-testid="club-name-input"
                    />
                  </div>
                  
                  <div>
                    <Label>Club Logo</Label>
                    <div className="mt-2 space-y-3">
                      {clubLogo && (
                        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                          <img 
                            src={clubLogo} 
                            alt="Club logo preview" 
                            className="h-12 w-auto object-contain"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setClubLogo('')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      )}
                      <div>
                        <Label 
                          htmlFor="logo-upload" 
                          className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-fit"
                        >
                          <Upload className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-600">Upload logo image</span>
                        </Label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error('Logo must be less than 2MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setClubLogo(ev.target?.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          data-testid="logo-upload-input"
                        />
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG or SVG. Max 2MB.</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={async () => {
                      setSavingClub(true);
                      try {
                        const result = await updateOrganization({
                          club_name: clubName || null,
                          club_logo: clubLogo || null
                        });
                        if (result.ok) {
                          toast.success('Club settings saved');
                          refreshOrganization();
                        } else {
                          toast.error(result.error || 'Failed to save');
                        }
                      } catch (err) {
                        toast.error('Failed to save club settings');
                      } finally {
                        setSavingClub(false);
                      }
                    }}
                    disabled={savingClub}
                    data-testid="save-club-btn"
                  >
                    {savingClub ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save Club Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Coach-only view */}
        {!isCoachDeveloper() && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-slate-500">
                Contact your Coach Developer to update your account settings.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
    </SwipeablePageWrapper>
  );
}
