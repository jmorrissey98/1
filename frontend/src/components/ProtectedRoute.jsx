import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ 
  children, 
  requireCoachDeveloper = false,
  requireCoach = false,
  requireAdmin = false
}) {
  const { user, loading, isCoachDeveloper, isAdmin } = useAuth();
  const location = useLocation();
  
  // Check if user is in impersonation mode
  const isImpersonating = localStorage.getItem('impersonating') === 'true';

  // Check if user was passed from AuthCallback
  if (location.state?.user) {
    // User just authenticated - render children immediately
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading...</p>
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

  // Check coach developer role requirement
  if (requireCoachDeveloper && !isCoachDeveloper()) {
    // Redirect coaches to their dashboard
    if (user.role === 'coach') {
      return <Navigate to="/coach" replace />;
    }
    // Redirect admin to admin dashboard (only if not impersonating)
    if (user.role === 'admin' && !isImpersonating) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
