import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ 
  children, 
  requireCoachDeveloper = false,
  requireCoach = false,
  requireAdmin = false,
  allowCoachDeveloper = false  // Allow coach_developer role to access coach routes
}) {
  const { user, loading, isCoachDeveloper, isAdmin, checkAuth } = useAuth();
  const location = useLocation();
  const [revalidating, setRevalidating] = useState(false);
  
  // Check if user is in impersonation mode
  const isImpersonating = localStorage.getItem('impersonating') === 'true';
  
  // Check if we just exited impersonation - if so, force a refresh
  const justExitedImpersonation = localStorage.getItem('exiting_impersonation') === 'true';

  // Handle re-authentication after exiting impersonation
  useEffect(() => {
    if (justExitedImpersonation && requireAdmin) {
      // Clear the flag
      localStorage.removeItem('exiting_impersonation');
      // Force re-authentication
      setRevalidating(true);
      checkAuth().finally(() => {
        setRevalidating(false);
      });
    }
  }, [justExitedImpersonation, requireAdmin, checkAuth]);

  // If we're exiting impersonation, show loading and don't check roles yet
  if (justExitedImpersonation && requireAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Returning to admin...</p>
        </div>
      </div>
    );
  }

  // Check if user was passed from AuthCallback
  if (location.state?.user) {
    // User just authenticated - render children immediately
    return children;
  }

  if (loading || revalidating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{revalidating ? 'Returning to admin...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block admin pages when impersonating
  if (requireAdmin && isImpersonating) {
    return <Navigate to="/" replace />;
  }

  // Check admin role requirement
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Check coach role requirement
  // allowCoachDeveloper flag allows coach_developer role users to access coach routes (e.g., My Development)
  if (requireCoach) {
    const isAllowedRole = user.role === 'coach' || (allowCoachDeveloper && user.role === 'coach_developer');
    if (!isAllowedRole) {
      return <Navigate to="/" replace />;
    }
  }

  // Check coach developer role requirement (admins also have access)
  if (requireCoachDeveloper && !isCoachDeveloper() && user.role !== 'admin') {
    // Redirect coaches to their dashboard
    if (user.role === 'coach') {
      return <Navigate to="/coach" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
