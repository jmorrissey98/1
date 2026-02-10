import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, Loader2, Mail, Lock, User, Eye, EyeOff, Building2, ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { safePost, safeGet } from '../lib/safeFetch';

const API_URL = ''; // Relative URL - frontend and backend on same domain

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
  
  // Sign Up form state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState('');
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [checkingFirstUser, setCheckingFirstUser] = useState(true);
  
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const error = location.state?.error;

  // Check if this will be the first user
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const result = await safeGet(`${API_URL}/api/users/check-first`);
        setIsFirstUser(result.ok && result.data?.is_first === true);
      } catch (e) {
        setIsFirstUser(false);
      } finally {
        setCheckingFirstUser(false);
      }
    };
    checkFirstUser();
  }, []);

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
      
      toast.success('Welcome back!');
      await checkAuth();
      
    } catch (err) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!signUpName || !signUpEmail || !signUpPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (signUpPassword !== signUpConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (signUpPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    // Check password has at least one letter and one number
    if (!/[A-Za-z]/.test(signUpPassword)) {
      toast.error('Password must contain at least one letter');
      return;
    }
    if (!/\d/.test(signUpPassword)) {
      toast.error('Password must contain at least one number');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const signupPayload = {
        name: signUpName,
        email: signUpEmail,
        password: signUpPassword
      };
      
      // Add club info if this is the first user
      if (isFirstUser && clubName) {
        signupPayload.club_name = clubName;
        signupPayload.club_logo = clubLogo || null;
      }
      
      const result = await safePost(`${API_URL}/api/auth/signup`, signupPayload);
      
      if (result.networkError) {
        toast.error('Unable to connect. Please check your internet connection.');
        return;
      }
      
      if (!result.ok) {
        // Show the specific error from the server
        const errorMessage = result.data?.detail || 'Signup failed. Please try again.';
        toast.error(errorMessage);
        console.error('Signup failed:', result.data);
        return;
      }
      
      toast.success('Account created successfully!');
      await checkAuth();
      
    } catch (err) {
      toast.error('Signup failed. Please try again.');
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
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white font-['Manrope']">CD</span>
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
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white font-['Manrope']">CD</span>
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
              <TabsTrigger value="signup" data-testid="signup-tab">Sign Up</TabsTrigger>
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
            
            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="pl-10"
                      data-testid="signup-name-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="pl-10"
                      data-testid="signup-email-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="pl-10 pr-10"
                      data-testid="signup-password-input"
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
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="signup-confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      className="pl-10"
                      data-testid="signup-confirm-password-input"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Password must be at least 8 characters with at least one letter and one number.
                  </p>
                </div>
                
                {/* Club branding fields - only for first user */}
                {isFirstUser && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="text-sm text-slate-600 bg-emerald-50 p-3 rounded-lg">
                      <strong>You're the first user!</strong> Set up your club branding below.
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="club-name">Club Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="club-name"
                          type="text"
                          placeholder="Your Club Name"
                          value={clubName}
                          onChange={(e) => setClubName(e.target.value)}
                          className="pl-10"
                          data-testid="signup-club-name-input"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="club-logo">Club Logo URL (optional)</Label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="club-logo"
                          type="url"
                          placeholder="https://example.com/logo.png"
                          value={clubLogo}
                          onChange={(e) => setClubLogo(e.target.value)}
                          className="pl-10"
                          data-testid="signup-club-logo-input"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        You can add or change this later in Settings.
                      </p>
                    </div>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="signup-submit-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create Account
                </Button>
              </form>
              
              <p className="text-xs text-center text-slate-500 mt-2">
                Note: You need an invite from a Coach Developer to create an account.
                <br />
                The first user to sign up becomes the admin.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
