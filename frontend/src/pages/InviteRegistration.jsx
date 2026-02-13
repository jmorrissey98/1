import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Lock, Eye, EyeOff, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';
import { safeGet, safePost, setAuthToken } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function InviteRegistration() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [inviteData, setInviteData] = useState(null);
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Validate invite on mount
  useEffect(() => {
    const validateInvite = async () => {
      try {
        const result = await safeGet(`${API_URL}/api/invites/validate/${inviteId}`);
        
        if (!result.ok) {
          setError('Failed to validate invitation');
          return;
        }
        
        if (!result.data.valid) {
          setError(result.data.error || 'Invalid invitation');
          return;
        }
        
        setInviteData(result.data);
      } catch (err) {
        setError('Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    };
    
    validateInvite();
  }, [inviteId]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result);
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    // Check password has at least one letter and one number
    if (!/[A-Za-z]/.test(password)) {
      toast.error('Password must contain at least one letter');
      return;
    }
    if (!/\d/.test(password)) {
      toast.error('Password must contain at least one number');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const result = await safePost(`${API_URL}/api/auth/register-invite`, {
        invite_id: inviteId,
        password: password,
        photo: photo
      });
      
      if (!result.ok) {
        const errorMsg = result.data?.detail || 'Registration failed';
        toast.error(errorMsg);
        return;
      }
      
      // Store the auth token
      if (result.data?.token) {
        setAuthToken(result.data.token);
      }
      
      toast.success('Account created successfully!');
      await checkAuth();
      
      // Navigate to dashboard
      navigate('/');
      
    } catch (err) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="mt-2 text-slate-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src="/mcd-logo.png" alt="My Coach Developer" className="w-16 h-16 mx-auto mb-4" />
            <CardTitle className="text-xl text-slate-900">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-slate-600 text-center mb-4">
              This invitation link may have expired or already been used.
            </p>
            <Button 
              className="w-full" 
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleDisplay = inviteData?.role === 'coach_developer' ? 'Coach Developer' : 'Coach';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/mcd-logo.png" alt="My Coach Developer" className="w-16 h-16 mx-auto mb-4" />
          <CardTitle className="text-xl text-slate-900">Complete Your Registration</CardTitle>
          <CardDescription>
            You've been invited to join as a <strong>{roleDisplay}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pre-populated fields (read-only) */}
            <div className="space-y-4 pb-4 border-b border-slate-200">
              <div className="space-y-2">
                <Label className="text-slate-500">Name</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-md">
                  <span className="text-slate-700">{inviteData?.name || 'Not provided'}</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-500">Email</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-md">
                  <span className="text-slate-700">{inviteData?.email}</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              </div>
            </div>
            
            {/* Profile Photo */}
            <div className="space-y-2">
              <Label>Profile Photo (Optional)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={photoPreview} />
                  <AvatarFallback className="bg-slate-200 text-slate-600">
                    {inviteData?.name?.[0] || inviteData?.email?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="photo-upload"
                    data-testid="photo-upload"
                  />
                  <label htmlFor="photo-upload">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Camera className="w-4 h-4 mr-2" />
                        Upload Photo
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Max 5MB, JPG or PNG</p>
                </div>
              </div>
            </div>
            
            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                At least 8 characters with a letter and number
              </p>
            </div>
            
            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  data-testid="confirm-password-input"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={submitting}
              data-testid="submit-registration"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Complete Registration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
