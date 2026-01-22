import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Shield, UserPlus, Trash2, LogOut, Loader2, Send } from 'lucide-react';
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
import { storage } from '../lib/storage';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user, logout, isCoachDeveloper } = useAuth();
  const API_URL = process.env.REACT_APP_BACKEND_URL || '';
  
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('coach');
  const [inviteCoachId, setInviteCoachId] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load coaches from local storage
      setCoaches(storage.getCoaches());
      
      if (isCoachDeveloper()) {
        // Load users and invites from backend
        try {
          const usersRes = await fetch(`${API_URL}/api/users`, { credentials: 'include' });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            setUsers(usersData);
          }
        } catch (e) {
          console.error('Failed to load users:', e);
        }
        
        try {
          const invitesRes = await fetch(`${API_URL}/api/invites`, { credentials: 'include' });
          if (invitesRes.ok) {
            const invitesData = await invitesRes.json();
            setInvites(invitesData);
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
      const response = await fetch(`${API_URL}/api/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          coach_id: inviteRole === 'coach' && inviteCoachId && inviteCoachId !== 'none' ? inviteCoachId : null
        })
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error('Failed to parse response:', text);
        throw new Error('Server error - please try again');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create invite');
      }

      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteCoachId('');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteInvite = async (inviteId) => {
    try {
      const response = await fetch(`${API_URL}/api/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
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
      const response = await fetch(`${API_URL}/api/invites/${inviteId}/resend`, {
        method: 'POST',
        credentials: 'include'
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to resend invite');
      }

      toast.success(`Invite email resent to ${email}`);
    } catch (err) {
      toast.error(err.message || 'Failed to resend invite');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, new_role: newRole })
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update role');
      }

      toast.success('Role updated');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete user');
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
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="invites" data-testid="tab-invites">
                <Mail className="w-4 h-4 mr-2" />
                Invites
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Users
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
                              </div>
                            </div>
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
