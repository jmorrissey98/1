import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Home, Users, ClipboardList, Calendar, Cog, TrendingUp, User, XCircle, Eye } from 'lucide-react';
import { Button } from './ui/button';
import SyncStatusIndicator from './SyncStatusIndicator';
import { toast } from 'sonner';
import { setAuthToken } from '../lib/safeFetch';

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
  const { user, isCoachDeveloper, isCoach, isAdmin } = useAuth();
  const { organization } = useOrganization();
  const [impersonating, setImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  
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
  
  // Exit impersonation mode - clears session and returns to login
  // Note: Admin will need to login again after exiting impersonation
  const handleExitImpersonation = () => {
    // Clear all auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('impersonating');
    localStorage.removeItem('impersonated_user');
    localStorage.removeItem('impersonated_by');
    localStorage.removeItem('admin_token_backup');
    
    toast.success('Exited impersonation mode');
    
    // Redirect to login page
    window.location.href = '/login';
  };
  
  // Check if impersonating
  const isImpersonatingUser = localStorage.getItem('impersonating') === 'true';
  
  // Don't show header on excluded pages, admin pages (unless impersonating), or when not logged in
  const shouldHide = !user || 
    EXCLUDED_PATHS.some(path => location.pathname.startsWith(path)) ||
    (isAdmin && isAdmin() && !isImpersonatingUser);
  
  if (shouldHide) return null;
  
  const isCoachDev = isCoachDeveloper && isCoachDeveloper();
  const isCoachUser = isCoach && isCoach();
  
  // Get home path based on user role
  const getHomePath = () => {
    if (isCoachUser && user?.linked_coach_id) {
      return `/coach-view/${user.linked_coach_id}`;
    }
    return '/';
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
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left side - Club branding */}
        <div className="flex items-center gap-3">
          {organization?.club_logo && (
            <img 
              src={organization.club_logo} 
              alt={organization.club_name || 'Club logo'} 
              className="h-10 w-auto object-contain"
            />
          )}
          {organization?.club_name && (
            <span className="font-semibold text-slate-900 font-['Manrope'] text-lg">
              {organization.club_name}
            </span>
          )}
          <SyncStatusIndicator />
        </div>
        
        {/* Center - Navigation buttons */}
        <div className="flex items-center gap-2">
          {/* Home button - always visible */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(getHomePath())}
            data-testid="nav-home-btn"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          {/* Coach Developer Navigation */}
          {isCoachDev && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/coaches')}
                data-testid="nav-my-coaches-btn"
              >
                <Users className="w-4 h-4 mr-1.5" />
                My Coaches
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/templates')}
                data-testid="nav-templates-btn"
              >
                <ClipboardList className="w-4 h-4 mr-1.5" />
                Templates
              </Button>
            </>
          )}
          
          {/* Coach Navigation */}
          {isCoachUser && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/coach/development')}
                data-testid="nav-my-development-btn"
              >
                <TrendingUp className="w-4 h-4 mr-1.5" />
                My Development
              </Button>
            </>
          )}
          
          {/* Common navigation for all users */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/calendar')}
            data-testid="nav-calendar-btn"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Calendar
          </Button>
          
          {/* Coach Developer Settings button */}
          {isCoachDev && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings')}
              data-testid="nav-settings-btn"
            >
              <Cog className="w-4 h-4 mr-1.5" />
              Settings
            </Button>
          )}
          
          {/* Coach Profile button (includes settings) */}
          {isCoachUser && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/coach/profile')}
              data-testid="nav-my-profile-btn"
            >
              <User className="w-4 h-4 mr-1.5" />
              My Profile
            </Button>
          )}
        </div>
        
        {/* Right side - MCD Logo */}
        <img 
          src="/mcd-logo.png" 
          alt="My Coach Developer" 
          className="h-10 w-auto object-contain cursor-pointer"
          onClick={() => navigate(getHomePath())}
          data-testid="mcd-app-logo"
        />
      </div>
    </div>
    </>
  );
}
