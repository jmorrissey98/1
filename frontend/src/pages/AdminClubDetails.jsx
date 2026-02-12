import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Users, UserPlus, Loader2, AlertCircle, Key, Trash2, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { safeGet, safePost, safeDelete, setAuthToken, getAuthToken } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminClubDetails() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  
  // Reset password dialog state
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Delete user dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load organization details
      const orgsResult = await safeGet(`${API_URL}/api/admin/organizations`);
      if (orgsResult.ok) {
        const org = orgsResult.data?.find(o => o.org_id === orgId);
        setOrganization(org);
      }
      
      // Load users
      const usersResult = await safeGet(`${API_URL}/api/admin/organizations/${orgId}/users`);
      if (usersResult.ok) {
        setUsers(usersResult.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }
    
    setResettingPassword(true);
    
    try {
      const result = await safePost(`${API_URL}/api/admin/users/${selectedUser.user_id}/reset-password`, {
        new_password: newPassword
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }
      
      toast.success('Password reset successfully');
      setResetPasswordOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    
    try {
      const result = await safeDelete(`${API_URL}/api/admin/users/${userToDelete.user_id}`);
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }
      
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleImpersonate = async (user) => {
    try {
      const result = await safePost(`${API_URL}/api/admin/impersonate/${user.user_id}`);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || result.error || 'Failed to impersonate user');
      }
      
      // Store impersonation metadata in localStorage for UI purposes
      localStorage.setItem('impersonating', 'true');
      localStorage.setItem('impersonated_user', JSON.stringify(result.data.user));
      localStorage.setItem('impersonated_by', result.data.impersonated_by);
      
      toast.success(`Now viewing as ${result.data.user.name}`);
      
      // Navigate based on user role
      if (result.data.user.role === 'coach') {
        window.location.href = `/coach-view/${result.data.user.linked_coach_id}`;
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      toast.error(err.message || 'Failed to impersonate user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">{error || 'Organization not found'}</p>
            <Button onClick={() => navigate('/admin')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/admin')}
            className="text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={organization.club_logo} />
              <AvatarFallback className="bg-slate-700 text-slate-300">
                {organization.club_name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold font-['Manrope']">{organization.club_name || 'Club Details'}</h1>
              <p className="text-sm text-slate-400">{orgId}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{organization.user_count || 0}</p>
                  <p className="text-sm text-slate-500">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{organization.coach_count || 0}</p>
                  <p className="text-sm text-slate-500">Coaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Users</CardTitle>
                <CardDescription>All users in this organization</CardDescription>
              </div>
              <Button onClick={() => navigate('/admin/users/new')} size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No users in this organization.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div 
                    key={user.user_id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    data-testid={`user-item-${user.user_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-slate-200 text-slate-600">
                          {user.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-slate-900">{user.name}</h3>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={user.role === 'coach_developer' ? 'default' : 'secondary'}>
                        {user.role?.replace('_', ' ')}
                      </Badge>
                      
                      {/* Impersonate Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImpersonate(user)}
                        title="View as this user"
                        data-testid={`impersonate-${user.user_id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      {/* Reset Password Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setResetPasswordOpen(true);
                        }}
                        title="Reset password"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser} 
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
