import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Camera, Loader2, Save, Mail, Shield, Upload } from 'lucide-react';
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
import { safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CoachMyProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  
  // Form state
  const [roleTitle, setRoleTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

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
      setPhotoUrl(result.data.photo || '');
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
        bio: bio || null,
        photo: photoUrl || null
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

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }

      const data = await response.json();
      // Use the url returned from the upload endpoint (includes filename with extension)
      const newPhotoUrl = `${API_URL}${data.url}`;
      setPhotoUrl(newPhotoUrl);
      
      // Update the profile with the new photo
      const updateResult = await updateCoachProfile({
        photo: newPhotoUrl
      });
      
      if (updateResult.ok) {
        setProfile(prev => ({ ...prev, photo: newPhotoUrl }));
        toast.success('Profile photo updated');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-['Manrope']">My Profile</h1>
            <p className="text-sm text-slate-500">Manage your profile and settings</p>
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

        {/* Profile Photo & Name */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={photoUrl || profile?.photo} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl">
                    {profile?.name?.charAt(0) || user?.name?.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  data-testid="photo-upload-input"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-1 -right-1 rounded-full w-8 h-8 p-0 bg-white shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Upload photo"
                  data-testid="upload-photo-btn"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </Button>
              </div>
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
