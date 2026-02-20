import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ 
  children, 
  requireCoachDeveloper = false,
  requireCoach = false,
  requireAdmin = false
}) {
  const { user, loading, isCoachDeveloper, isAdmin, checkAuth } = useAuth();
  const location = useLocation();
  const [revalidating, setRevalidating] = useState(false);
  
  // Check if user is in impersonation mode
  const isImpersonating = localStorage.getItem('impersonating') === 'true';
  
  // Check if we just exited impersonation (token restored but user not re-fetched yet)
  useEffect(() => {
    const justExitedImpersonation = localStorage.getItem('exiting_impersonation') === 'true';
    if (justExitedImpersonation && requireAdmin) {
      // Clear the flag and revalidate auth
      localStorage.removeItem('exiting_impersonation');
      setRevalidating(true);
      checkAuth().then(() => {
        setRevalidating(false);
      });
    }
  }, [requireAdmin, checkAuth]);

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
  if (requireCoach && user.role !== 'coach') {
    return <Navigate to="/" replace />;
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
