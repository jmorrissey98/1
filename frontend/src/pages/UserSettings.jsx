import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Shield, UserPlus, Trash2, LogOut, Loader2, Send, Building2, Upload, X, Database } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { storage } from '../lib/storage';
import { safeGet, safePost, safeDelete, safePut } from '../lib/safeFetch';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user, logout, isCoachDeveloper } = useAuth();
  const { organization, updateOrganization, refreshOrganization } = useOrganization();
  const API_URL = ''; // Relative URL - frontend and backend on same domain
  
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('coach');
  const [inviteCoachId, setInviteCoachId] = useState('');
  const [inviting, setInviting] = useState(false);
  
  // Club settings state
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState('');
  const [savingClub, setSavingClub] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  
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
        // Load coaches from API (not localStorage)
        try {
          const coachesResult = await safeGet(`${API_URL}/api/coaches`);
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

    setInviting(true);
    try {
      const result = await safePost(`${API_URL}/api/invites`, {
        email: inviteEmail.trim().toLowerCase(),
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
      setInviteCoachId('');
      await loadData();
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
    <div className="min-h-screen bg-slate-50">
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
                <Badge className={user?.role === 'coach_developer' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                  {user?.role === 'coach_developer' ? 'Coach Developer' : 'Coach'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Developer Only: Team Management */}
        {isCoachDeveloper() && (
          <Tabs defaultValue="invites" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="invites" data-testid="tab-invites">
                <Mail className="w-4 h-4 mr-2" />
                Invites
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="club" data-testid="tab-club">
                <Building2 className="w-4 h-4 mr-2" />
                Club
              </TabsTrigger>
              <TabsTrigger value="admin" data-testid="tab-admin">
                <Database className="w-4 h-4 mr-2" />
                Admin
              </TabsTrigger>
            </TabsList>

            {/* Invites Tab */}
            <TabsContent value="invites">
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Invite New User
                  </CardTitle>
                  <CardDescription>
                    Send an invite to allow someone to create an account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div>
                      <Label htmlFor="invite-email">Email Address</Label>
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
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="mt-1" data-testid="invite-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="coach_developer">Coach Developer</SelectItem>
                        </SelectContent>
                      </Select>
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

                    <Button type="submit" disabled={inviting} data-testid="send-invite-btn">
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
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
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
            <TabsContent value="club">
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

            {/* Admin Tab */}
            <TabsContent value="admin">
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Admin Tools
                  </CardTitle>
                  <CardDescription>
                    Advanced tools for data management and recovery
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user?.email === 'joemorrisseyg@gmail.com' ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h4 className="font-semibold text-amber-800 mb-2">Data Recovery Tool</h4>
                        <p className="text-sm text-amber-700 mb-3">
                          Export all locally stored data before migrating to the cloud database.
                        </p>
                        <Button onClick={() => navigate('/data-recovery')} data-testid="data-recovery-btn">
                          <Database className="w-4 h-4 mr-2" />
                          Open Data Recovery
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">
                      No admin tools available for your account.
                    </p>
                  )}
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
  );
}
