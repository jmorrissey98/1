import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';

// Pages where we don't show the app header (they have their own headers)
const EXCLUDED_PATHS = [
  '/login',
  '/reset-password',
  '/auth/callback',
  '/session/',
  '/live/',
  '/review/',
];

export default function AppHeader() {
  const location = useLocation();
  const { user } = useAuth();
  const { organization } = useOrganization();
  
  // Don't show header on excluded pages or when not logged in
  const shouldHide = !user || EXCLUDED_PATHS.some(path => location.pathname.startsWith(path));
  
  if (shouldHide) return null;
  
  // Only show if there's club branding
  if (!organization?.club_name && !organization?.club_logo) return null;
  
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {organization?.club_logo && (
          <img 
            src={organization.club_logo} 
            alt={organization.club_name || 'Club logo'} 
            className="h-8 w-auto object-contain"
          />
        )}
        {organization?.club_name && (
          <span className="font-semibold text-slate-900 font-['Manrope']">
            {organization.club_name}
          </span>
        )}
      </div>
    </div>
  );
}
