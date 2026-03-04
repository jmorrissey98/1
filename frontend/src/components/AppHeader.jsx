import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Home, Users, ClipboardList, Calendar, Cog, TrendingUp, User, XCircle, Eye, Menu, X, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import SyncStatusIndicator from './SyncStatusIndicator';
import { toast } from 'sonner';
import { setAuthToken, getAuthToken, safeGet } from '../lib/safeFetch';

// Pages where we don't show the app header (they have their own headers)
const EXCLUDED_PATHS = [
  '/login',
  '/reset-password',
  '/auth/callback',
  // Note: /admin excluded below UNLESS impersonating
];

// Root path "/" shows landing page for unauthenticated users, so header is handled by RootRoute
const isRootPath = (path) => path === '/';

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isCoachDeveloper, isCoach, isAdmin, logout } = useAuth();
  const { organization } = useOrganization();
  const [impersonating, setImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  
  const API_URL = process.env.REACT_APP_BACKEND_URL || '';
  
  // Fetch subscription tier for navigation customization
  useEffect(() => {
    const fetchTier = async () => {
      if (!user || user.role === 'admin' || user.role === 'coach') return;
      
      try {
        const result = await safeGet(`${API_URL}/api/subscriptions/limits-summary`);
        if (result.ok && result.data) {
          setSubscriptionTier(result.data.tier_key);
        }
      } catch (e) {
        console.error('Failed to fetch subscription tier:', e);
      }
    };
    
    fetchTier();
  }, [user, API_URL]);
  
  // Check if we're in impersonation mode - run on every render and route change
  useEffect(() => {
    const checkImpersonation = () => {
      const isImp = localStorage.getItem('impersonating') === 'true';
      setImpersonating(isImp);
      if (isImp) {
        try {
          const userData = JSON.parse(localStorage.getItem('impersonated_user') || '{}');
          setImpersonatedUser(userData);
        } catch (e) {
          console.error('Failed to parse impersonated user data');
        }
      } else {
        setImpersonatedUser(null);
      }
    };
    
    checkImpersonation();
    
    // Also listen for storage changes (in case impersonation is set from another component)
    window.addEventListener('storage', checkImpersonation);
    return () => window.removeEventListener('storage', checkImpersonation);
  }, [location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);
  
  // Exit impersonation mode - restores admin session via API
  const handleExitImpersonation = async () => {
    try {
      // Call the backend to restore admin session
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/admin/exit-impersonation`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to exit impersonation');
      }
      
      const data = await response.json();
      
      // Clear impersonation state from localStorage
      localStorage.removeItem('impersonating');
      localStorage.removeItem('impersonated_user');
      localStorage.removeItem('impersonated_by');
      localStorage.removeItem('admin_token_backup');
      
      // CRITICAL: Restore the admin token to localStorage (returned from backend)
      if (data.admin_token) {
        localStorage.setItem('auth_token', data.admin_token);
      }
      
      toast.success('Returned to admin view');
      
      // Navigate to admin dashboard and reload to get fresh auth state
      navigate('/admin');
      window.location.reload();
    } catch (err) {
      console.error('Error exiting impersonation:', err);
      // Fallback: clear everything and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('admin_token_backup');
      localStorage.removeItem('impersonating');
      localStorage.removeItem('impersonated_user');
      localStorage.removeItem('impersonated_by');
      
      toast.error(err.message || 'Failed to exit impersonation. Please login again.');
      window.location.href = '/login';
    }
  };
  
  // Check if impersonating
  const isImpersonatingUser = localStorage.getItem('impersonating') === 'true';
  
  // Check if on admin pages
  const isOnAdminPage = location.pathname.startsWith('/admin');
  
  // Don't show header on excluded pages, or admin pages (unless impersonating), or when not logged in
  // Also hide on root path "/" when user is not logged in (landing page has its own header)
  const shouldHide = !user || 
    EXCLUDED_PATHS.some(path => location.pathname.startsWith(path)) ||
    (isOnAdminPage && !isImpersonatingUser) ||
    (isRootPath(location.pathname) && !user);
  
  if (shouldHide) return null;
  
  const isCoachDev = isCoachDeveloper && isCoachDeveloper();
  const isCoachUser = isCoach && isCoach();
  
  // Get home path based on user role
  const getHomePath = () => {
    if (isCoachUser) {
      return '/coach/dashboard';
    }
    return '/';
  };

  // Check if user is on Individual Coach tier (self-observation only, no coach management)
  const isIndividualCoachTier = subscriptionTier === 'individual_coach';

  // Navigation items for Coach Developer
  // - Individual Coach tier: Hide "My Coaches", Show "My Development"
  // - Coach Developer/Club tiers: Show "My Coaches", Hide "My Development" (for now)
  const coachDevNavItems = [
    { label: 'Home', icon: Home, path: getHomePath(), testId: 'nav-home-btn' },
    // Only show My Coaches for Coach Developer and Club tiers (not Individual Coach)
    ...(!isIndividualCoachTier ? [{ label: 'My Coaches', icon: Users, path: '/coaches', testId: 'nav-my-coaches-btn' }] : []),
    // Show My Development ONLY for Individual Coach tier (hidden for Coach Developer/Club tiers for now)
    ...(isIndividualCoachTier ? [{ label: 'My Development', icon: TrendingUp, path: '/coach/development', testId: 'nav-my-development-btn' }] : []),
    { label: 'Templates', icon: ClipboardList, path: '/templates', testId: 'nav-templates-btn' },
    { label: 'Calendar', icon: Calendar, path: '/calendar', testId: 'nav-calendar-btn' },
    { label: 'Settings', icon: Cog, path: '/settings', testId: 'nav-settings-btn' },
  ];

  // Navigation items for Coach
  const coachNavItems = [
    { label: 'Home', icon: Home, path: getHomePath(), testId: 'nav-home-btn' },
    { label: 'My Development', icon: TrendingUp, path: '/coach/development', testId: 'nav-my-development-btn' },
    { label: 'Calendar', icon: Calendar, path: '/coach/calendar', testId: 'nav-calendar-btn' },
    { label: 'My Profile', icon: User, path: '/coach/profile', testId: 'nav-my-profile-btn' },
  ];

  const navItems = isCoachUser ? coachNavItems : coachDevNavItems;

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };
  
  return (
    <>
      {/* Impersonation Banner */}
      {impersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center flex items-center justify-center gap-3">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">
            Viewing as: <strong>{impersonatedUser?.name || user?.name}</strong> ({impersonatedUser?.role || user?.role})
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExitImpersonation}
            className="ml-2 bg-amber-100 hover:bg-amber-200 text-amber-900 h-7"
            data-testid="exit-impersonation-btn"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Exit
          </Button>
        </div>
      )}
      
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-0 z-20 safe-area-top">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left side - Club branding */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            {organization?.club_logo && (
              <img 
                src={organization.club_logo} 
                alt={organization.club_name || 'Club logo'} 
                className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
              />
            )}
            {organization?.club_name && (
              <span className="font-semibold text-slate-900 font-['Manrope'] text-sm sm:text-lg truncate max-w-[100px] sm:max-w-none">
                {organization.club_name}
              </span>
            )}
            <div className="hidden sm:block">
              <SyncStatusIndicator />
            </div>
          </div>
          
          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Button 
                key={item.path}
                variant="outline" 
                size="sm"
                onClick={() => navigate(item.path)}
                data-testid={item.testId}
                className={location.pathname === item.path ? 'bg-slate-100' : ''}
              >
                <item.icon className="w-4 h-4 mr-1.5" />
                {item.label}
              </Button>
            ))}
          </div>
          
          {/* Right side - Logo (desktop) + Hamburger (mobile) */}
          <div className="flex items-center gap-2">
            {/* MCD Logo - Desktop only */}
            <div 
              className="hidden sm:flex flex-col items-center cursor-pointer"
              onClick={() => navigate(getHomePath())}
              data-testid="mcd-app-logo"
            >
              <img 
                src="/mcd-logo.png" 
                alt="My Coach Developer" 
                className="h-10 w-auto object-contain"
              />
              <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                My Coach Developer
              </span>
            </div>

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="md:hidden"
                  data-testid="mobile-menu-btn"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img 
                      src="/mcd-logo.png" 
                      alt="My Coach Developer" 
                      className="h-8 w-auto object-contain"
                    />
                    <span className="text-sm">My Coach Developer</span>
                  </SheetTitle>
                </SheetHeader>
                
                {/* Mobile Navigation */}
                <nav className="flex flex-col gap-2 mt-6">
                  {navItems.map((item) => (
                    <Button 
                      key={item.path}
                      variant={location.pathname === item.path ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      data-testid={`mobile-${item.testId}`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Button>
                  ))}
                  
                  {/* Divider */}
                  <div className="border-t border-slate-200 my-2" />
                  
                  {/* Sync Status on Mobile */}
                  <div className="px-4 py-2">
                    <SyncStatusIndicator showLabel />
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-slate-200 my-2" />
                  
                  {/* User Info */}
                  <div className="px-4 py-2">
                    <p className="text-sm text-slate-500">Logged in as</p>
                    <p className="font-medium text-slate-900 truncate">{user?.name || user?.email}</p>
                  </div>
                  
                  {/* Logout Button */}
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                    data-testid="mobile-logout-btn"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Log Out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </>
  );
}
