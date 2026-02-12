import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Home, Users, ClipboardList, Calendar, Cog } from 'lucide-react';
import { Button } from './ui/button';
import SyncStatusIndicator from './SyncStatusIndicator';

// Pages where we don't show the app header (they have their own headers)
const EXCLUDED_PATHS = [
  '/login',
  '/reset-password',
  '/auth/callback',
];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isCoachDeveloper } = useAuth();
  const { organization } = useOrganization();
  
  // Don't show header on excluded pages or when not logged in
  const shouldHide = !user || EXCLUDED_PATHS.some(path => location.pathname.startsWith(path));
  
  if (shouldHide) return null;
  
  return (
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
            onClick={() => navigate('/')}
            data-testid="nav-home-btn"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </Button>
          {isCoachDeveloper && isCoachDeveloper() && (
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/calendar')}
            data-testid="nav-calendar-btn"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Calendar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/settings')}
            data-testid="nav-settings-btn"
          >
            <Cog className="w-4 h-4 mr-1.5" />
            Settings
          </Button>
        </div>
        
        {/* Right side - MCD Logo */}
        <img 
          src="/mcd-logo.png" 
          alt="My Coach Developer" 
          className="h-10 w-auto object-contain cursor-pointer"
          onClick={() => navigate('/')}
          data-testid="mcd-app-logo"
        />
      </div>
    </div>
  );
}
