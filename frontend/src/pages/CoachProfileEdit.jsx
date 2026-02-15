import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Camera, Loader2, Save, CloudOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { fetchCoachProfile, updateCoachProfile } from '../lib/offlineApi';
import { useSync } from '../contexts/SyncContext';

export default function CoachProfileEdit() {
  const navigate = useNavigate();
  const { online } = useSync();
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/coach')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope']">My Profile</h1>
              <p className="text-xs sm:text-sm text-slate-500">Edit your profile information</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage 
                  src={profile?.photo && !profile.photo.includes('undefined') ? profile.photo : undefined} 
                  alt={profile?.name} 
                />
                <AvatarFallback className="bg-slate-200 text-slate-600 text-2xl">
                  {profile?.name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-slate-900">{profile?.name}</p>
                <p className="text-sm text-slate-500">{profile?.email}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Photo is synced from your Google account
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editable Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Profile Details</CardTitle>
            <CardDescription>
              Customize how your profile appears to observers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role Title */}
            <div>
              <Label htmlFor="roleTitle">Role / Job Title</Label>
              <Input
                id="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g., Head Coach, Assistant Coach, Lead Phase Coach"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your position within the coaching structure
              </p>
            </div>

            {/* Age Group */}
            <div>
              <Label htmlFor="ageGroup">Age Group / Team</Label>
              <Input
                id="ageGroup"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="e.g., Under 16s, Under 23s, First Team"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                The age group or team you primarily work with
              </p>
            </div>

            {/* Department */}
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., Academy, First Team, Women's Team"
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                The department or programme you're part of
              </p>
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio">Coaching Focus / Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a bit about your coaching philosophy, areas of focus, or development interests..."
                className="mt-2 min-h-[120px]"
              />
              <p className="text-xs text-slate-500 mt-1">
                A brief summary of your coaching approach or current focus areas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Read-only Info */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle className="font-['Manrope'] text-slate-600">Account Information</CardTitle>
            <CardDescription>
              These fields are managed by your organisation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-500">Email</span>
              <span className="font-medium">{profile?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-500">Account Type</span>
              <span className="font-medium">Coach</span>
            </div>
            <p className="text-xs text-slate-400 pt-2">
              Contact your Coach Developer to update account settings
            </p>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
