import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { safePost, setAuthToken } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading, checkAuth } = useAuth();

  const [activeTab, setActiveTab] = useState('signin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Sign In form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const error = location.state?.error;

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      if (user.role === 'coach' && user.linked_coach_id) {
        navigate(`/coach-view/${user.linked_coach_id}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    
    if (!signInEmail || !signInPassword) {
      toast.error('Please enter your email and password');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await safePost(`${API_URL}/api/auth/login`, {
        email: signInEmail,
        password: signInPassword
      });
      
      if (result.networkError) {
        toast.error(result.data?.detail || 'Unable to connect. Please try again.');
        return;
      }
      
      if (!result.ok) {
        toast.error(result.data?.detail || 'Login failed');
        return;
      }
      
      // Store the auth token for subsequent requests (needed for cross-domain auth)
      if (result.data?.token) {
        setAuthToken(result.data.token);
      }
      
      toast.success('Welcome back!');
      await checkAuth();
      
    } catch (err) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!forgotEmail) {
      toast.error('Please enter your email');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await safePost(`${API_URL}/api/auth/forgot-password`, { email: forgotEmail });
      
      if (result.networkError) {
        toast.error(result.data?.detail || 'Unable to connect. Please try again.');
        setIsSubmitting(false);
        return;
      }
      
      setForgotSent(true);
      toast.success('If an account exists, a reset link has been sent');
      
    } catch (err) {
      toast.error('Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-20 h-20 mx-auto mb-4">
              <img src="/mcd-logo.png" alt="My Coach Developer" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold font-['Manrope']">Reset Password</CardTitle>
            <CardDescription>
              {forgotSent 
                ? "Check your email for reset instructions" 
                : "Enter your email to receive a password reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotSent ? (
              <div className="space-y-4">
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    If an account with this email exists, you will receive a password reset link shortly.
                  </AlertDescription>
                </Alert>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                    setForgotEmail('');
                  }}
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10"
                      data-testid="forgot-email-input"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="send-reset-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Send Reset Link
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/mcd-logo.png" alt="My Coach Developer" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold font-['Manrope']">My Coach Developer</CardTitle>
          <CardDescription>Sign in to access your coaching observations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" data-testid="signin-tab">Sign In</TabsTrigger>
              <TabsTrigger value="create" data-testid="create-account-tab">Create Account</TabsTrigger>
            </TabsList>
            
            {/* Sign In Tab */}
            <TabsContent value="signin" className="space-y-4 mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="pl-10"
                      data-testid="signin-email-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="pl-10 pr-10"
                      data-testid="signin-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                    data-testid="forgot-password-link"
                  >
                    Forgot password?
                  </button>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="signin-submit-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            {/* Create Account Tab */}
            <TabsContent value="create" className="space-y-6 mt-4">
              <div className="text-center py-4">
                <p className="text-slate-600 mb-6">
                  To create an account, please choose a subscription plan first.
                </p>
                <Button 
                  onClick={() => navigate('/#pricing')}
                  className="bg-slate-900 hover:bg-slate-800"
                  data-testid="view-plans-btn"
                >
                  View Plans & Pricing
                  <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs text-center text-slate-500">
                  Already have an invite? Check your email for the signup link.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
