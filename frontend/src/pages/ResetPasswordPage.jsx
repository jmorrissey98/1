import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertCircle, Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { safeGet, safePost } from '../lib/safeFetch';

const API_URL = ''; // Relative URL - frontend and backend on same domain

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setError('No reset token provided');
      return;
    }

    const verifyToken = async () => {
      try {
        const result = await safeGet(`${API_URL}/api/auth/verify-reset-token/${token}`);
        
        if (result.networkError) {
          setError('Unable to connect. Please check your connection.');
          return;
        }
        
        if (result.data?.valid) {
          setIsValid(true);
          setEmail(result.data.email);
        } else {
          setError(result.data?.message || 'Invalid or expired reset token');
        }
      } catch (err) {
        setError('Failed to verify reset token');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await safePost(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: newPassword
      });
      
      if (result.networkError) {
        throw new Error('Unable to connect. Please check your connection.');
      }
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to reset password');
      }
      
      setIsSuccess(true);
      toast.success('Password reset successfully!');
      
    } catch (err) {
      setError(err.message || 'Failed to reset password');
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold font-['Manrope']">Password Reset</CardTitle>
            <CardDescription>Your password has been reset successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full"
              onClick={() => navigate('/login')}
              data-testid="go-to-login-btn"
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold font-['Manrope']">Invalid Link</CardTitle>
            <CardDescription>{error || 'This reset link is invalid or has expired'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full"
              onClick={() => navigate('/login')}
              data-testid="back-to-login-btn"
            >
              Back to Sign In
            </Button>
            <p className="text-xs text-center text-slate-500">
              Need a new reset link? Use the &quot;Forgot password&quot; option on the sign in page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white font-['Manrope']">CD</span>
          </div>
          <CardTitle className="text-2xl font-bold font-['Manrope']">Reset Password</CardTitle>
          <CardDescription>
            Enter a new password for {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  data-testid="new-password-input"
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
                Must be at least 8 characters with a letter and number
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
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
              disabled={isSubmitting}
              data-testid="reset-password-btn"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
