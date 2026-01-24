import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Camera, Loader2, Save, Mail, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { fetchCoachProfile, updateCoachProfile } from '../lib/offlineApi';
import { useAuth } from '../contexts/AuthContext';

export default function CoachMyProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  
  // Form state
  const [roleTitle, setRoleTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCoachProfile();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load profile');
      }
      
      setProfile(result.data);
      setRoleTitle(result.data.role_title || '');
      setAgeGroup(result.data.age_group || '');
      setDepartment(result.data.department || '');
      setBio(result.data.bio || '');
    } catch (err) {
      console.error('Profile error:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const result = await updateCoachProfile({
        role_title: roleTitle || null,
        age_group: ageGroup || null,
        department: department || null,
        bio: bio || null
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to save profile');
      }
      
      if (result.queued) {
        toast.success('Profile saved locally - will sync when online');
      } else {
        toast.success('Profile updated');
      }
      setProfile(result.data);
    } catch (err) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (err) {
      toast.error('Failed to log out');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={loadProfile}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">My Development</h1>
              <p className="text-sm text-slate-500">Your coaching journey</p>
            </div>
            <Button onClick={handleSave} disabled={saving} data-testid="save-profile-btn">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4 -mb-4 border-b-0">
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach')}
              data-testid="nav-dashboard"
            >
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach/development')}
              data-testid="nav-development"
            >
              My Development
            </Button>
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              onClick={() => navigate('/coach/sessions')}
              data-testid="nav-sessions"
            >
              My Sessions
            </Button>
            <Button 
              variant="ghost" 
              className="rounded-b-none border-b-2 border-emerald-600 text-emerald-700 font-medium"
              data-testid="nav-profile"
            >
              My Profile
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Profile Photo & Name */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile?.photo} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl">
                  {profile?.name?.charAt(0) || user?.name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {profile?.name || user?.name || 'Coach'}
                </h3>
                <p className="text-slate-500 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Profile Details</CardTitle>
            <CardDescription>
              Information about your coaching role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="roleTitle">Role / Job Title</Label>
              <Input
                id="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g., Head Coach U16s, Assistant Coach"
                className="mt-1"
                data-testid="role-title-input"
              />
            </div>
            
            <div>
              <Label htmlFor="ageGroup">Age Group / Team</Label>
              <Input
                id="ageGroup"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="e.g., U16 Boys, Senior Women's Team"
                className="mt-1"
                data-testid="age-group-input"
              />
            </div>
            
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., Academy, First Team"
                className="mt-1"
                data-testid="department-input"
              />
            </div>
            
            <div>
              <Label htmlFor="bio">Coaching Focus / Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about your coaching philosophy and areas of focus..."
                className="mt-1 min-h-[100px]"
                data-testid="bio-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Account Type</p>
                  <p className="text-sm text-slate-500">Coach</p>
                </div>
              </div>
            </div>

            <Separator />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  data-testid="logout-btn"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out of your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to sign in again to access your coaching data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="confirm-logout-btn"
                  >
                    Log Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
