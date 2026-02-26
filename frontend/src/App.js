import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster, toast } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SyncProvider } from "./contexts/SyncContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { CloudSyncProvider } from "./contexts/CloudSyncContext";
import { UpgradeProvider } from "./contexts/UpgradeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import OfflineIndicator from "./components/OfflineIndicator";
import AppHeader from "./components/AppHeader";
import { AnalyticsTracker } from "./hooks/useAnalytics";
import { Loader2, RefreshCw } from "lucide-react";
import HomePage from "./pages/HomePage";
import SessionSetup from "./pages/SessionSetup";
import LiveObservation from "./pages/LiveObservation";
import ReviewSession from "./pages/ReviewSession";
import TemplateManager from "./pages/TemplateManager";
import MyCoaches from "./pages/MyCoaches";
import CoachProfile from "./pages/CoachProfile";
import SessionCalendar from "./pages/SessionCalendar";
import UserSettings from "./pages/UserSettings";
import CoachView from "./pages/CoachView";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallback from "./pages/AuthCallback";
import LandingPage from "./pages/LandingPage";
import InviteRegistration from "./pages/InviteRegistration";
// Coach Role Pages
import CoachDashboard from "./pages/CoachDashboard";

// BUILD VERSION - Update on each deployment
// Format: YYYYMMDDHHMM
const BUILD_VERSION = "202402241600";
console.log(`[MCD] Build version: ${BUILD_VERSION}`);
import CoachDevelopment from "./pages/CoachDevelopment";
import CoachMyDevelopment from "./pages/CoachMyDevelopment";
import CoachSessions from "./pages/CoachSessions";
import CoachSessionDetail from "./pages/CoachSessionDetail";
import CoachMyProfile from "./pages/CoachMyProfile";
import CoachCalendar from "./pages/CoachCalendar";
// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminCreateClub from "./pages/AdminCreateClub";
import AdminCreateUser from "./pages/AdminCreateUser";
import AdminClubDetails from "./pages/AdminClubDetails";
// Admin Tools
import DataRecovery from "./pages/DataRecovery";
// Legal Pages
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CommercialTerms from "./pages/CommercialTerms";
import DataProcessing from "./pages/DataProcessing";
import "./App.css";

// Role-based home redirect component
function HomeRedirect() {
  const { user, isCoachDeveloper, isAdmin } = useAuth();
  
  // Check if impersonating - always show home page (don't redirect to admin)
  const isImpersonating = localStorage.getItem('impersonating') === 'true';
  
  // Admin goes to admin dashboard (but not if impersonating)
  if (user?.role === 'admin' && !isImpersonating) {
    return <Navigate to="/admin" replace />;
  }
  
  // Coach role goes to coach dashboard
  if (user?.role === 'coach') {
    return <Navigate to="/coach/dashboard" replace />;
  }
  
  // Coach Developer (or impersonating user) goes to main home page
  return <HomePage />;
}

// Component to handle root route - show landing page or redirect based on auth
function RootRoute() {
  const { user, loading } = useAuth();
  
  // Show nothing while loading auth state
  if (loading) {
    return null;
  }
  
  // If logged in, redirect to appropriate dashboard
  if (user) {
    return <HomeRedirect />;
  }
  
  // If not logged in, show landing page
  return <LandingPage />;
}

// Router component that handles session_id detection
function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id (synchronous, before any routes)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/register/:inviteId" element={<InviteRegistration />} />
      
      {/* Legal Pages - Public */}
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/commercial-terms" element={<CommercialTerms />} />
      <Route path="/data-processing" element={<DataProcessing />} />
      
      {/* Root - Landing page or Dashboard based on auth */}
      <Route path="/" element={<RootRoute />} />
      
      {/* Dashboard - for logged-in users */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <HomeRedirect />
        </ProtectedRoute>
      } />
      
      {/* Coach Role Routes */}
      <Route path="/coach" element={
        <ProtectedRoute requireCoach>
          <Navigate to="/coach/dashboard" replace />
        </ProtectedRoute>
      } />
      <Route path="/coach/dashboard" element={
        <ProtectedRoute requireCoach>
          <CoachDashboard />
        </ProtectedRoute>
      } />
      <Route path="/coach/development" element={
        <ProtectedRoute requireCoach>
          <CoachMyDevelopment />
        </ProtectedRoute>
      } />
      <Route path="/coach/sessions" element={
        <ProtectedRoute requireCoach>
          <CoachSessions />
        </ProtectedRoute>
      } />
      <Route path="/coach/session/:sessionId" element={
        <ProtectedRoute requireCoach>
          <CoachSessionDetail />
        </ProtectedRoute>
      } />
      <Route path="/coach/profile" element={
        <ProtectedRoute requireCoach>
          <CoachMyProfile />
        </ProtectedRoute>
      } />
      
      {/* Coach Developer / Observer Routes */}
      <Route path="/session/new" element={
        <ProtectedRoute requireCoachDeveloper>
          <SessionSetup />
        </ProtectedRoute>
      } />
      <Route path="/session/:sessionId/setup" element={
        <ProtectedRoute requireCoachDeveloper>
          <SessionSetup />
        </ProtectedRoute>
      } />
      <Route path="/session/:sessionId/observe" element={
        <ProtectedRoute requireCoachDeveloper>
          <LiveObservation />
        </ProtectedRoute>
      } />
      <Route path="/session/:sessionId/review" element={
        <ProtectedRoute>
          <ReviewSession />
        </ProtectedRoute>
      } />
      <Route path="/templates" element={
        <ProtectedRoute requireCoachDeveloper>
          <TemplateManager />
        </ProtectedRoute>
      } />
      <Route path="/coaches" element={
        <ProtectedRoute requireCoachDeveloper>
          <MyCoaches />
        </ProtectedRoute>
      } />
      <Route path="/coaches/:coachId" element={
        <ProtectedRoute requireCoachDeveloper>
          <CoachProfile />
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute requireCoachDeveloper>
          <SessionCalendar />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <UserSettings />
        </ProtectedRoute>
      } />
      {/* Redirect old coach-view URL to new path */}
      <Route path="/coach-view/:coachId" element={
        <ProtectedRoute>
          <Navigate to="/coach/development" replace />
        </ProtectedRoute>
      } />
      
      {/* Coach Calendar */}
      <Route path="/coach/calendar" element={
        <ProtectedRoute>
          <CoachCalendar />
        </ProtectedRoute>
      } />
      
      {/* Data Recovery - Admin Only */}
      <Route path="/data-recovery" element={
        <ProtectedRoute>
          <DataRecovery />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/exit-impersonation" element={<ExitImpersonationHandler />} />
      <Route path="/admin/clubs/new" element={
        <ProtectedRoute requireAdmin>
          <AdminCreateClub />
        </ProtectedRoute>
      } />
      <Route path="/admin/clubs/:orgId" element={
        <ProtectedRoute requireAdmin>
          <AdminClubDetails />
        </ProtectedRoute>
      } />
      <Route path="/admin/users/new" element={
        <ProtectedRoute requireAdmin>
          <AdminCreateUser />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

// Handler for exiting impersonation - waits for reauth then redirects to admin
function ExitImpersonationHandler() {
  const { checkAuth } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Clear the exit flag
    localStorage.removeItem('exiting_impersonation');
    
    // Force re-authentication with the restored admin token
    checkAuth().then(() => {
      // After auth refreshes, navigate to admin dashboard
      navigate('/admin', { replace: true });
    }).catch(() => {
      // If auth fails, go to login
      navigate('/login', { replace: true });
    });
  }, [checkAuth, navigate]);
  
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Returning to admin dashboard...</p>
      </div>
    </div>
  );
}

// Update notification component
function UpdateNotification({ onRefresh }) {
  return (
    <div className="fixed bottom-20 right-4 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right">
      <RefreshCw className="w-5 h-5" />
      <span className="text-sm font-medium">New version available!</span>
      <button 
        onClick={onRefresh}
        className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
      >
        Refresh
      </button>
    </div>
  );
}

function App() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    const handleSWUpdate = (event) => {
      console.log('[MCD] Service worker update detected');
      setShowUpdate(true);
    };

    // Listen for SW messages
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        const newVersion = event.data.version;
        const storedVersion = localStorage.getItem('mcd_sw_version');
        
        console.log('[MCD] SW version check - stored:', storedVersion, 'new:', newVersion);
        
        // Only show update banner if version actually changed
        if (storedVersion && storedVersion !== newVersion) {
          console.log('[MCD] New version detected, showing update banner');
          setShowUpdate(true);
        } else if (!storedVersion) {
          // First visit - just store the version, don't show banner
          console.log('[MCD] First visit, storing version');
        }
        
        // Always update stored version
        localStorage.setItem('mcd_sw_version', newVersion);
      }
    };

    window.addEventListener('swUpdate', handleSWUpdate);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      window.removeEventListener('swUpdate', handleSWUpdate);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  const handleRefresh = () => {
    // Tell the waiting service worker to take over
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    // Hard reload to get fresh content
    window.location.reload(true);
  };

  return (
    <div className="App min-h-screen bg-slate-50">
      <BrowserRouter>
        <AnalyticsTracker />
        <AuthProvider>
          <SyncProvider>
            <OrganizationProvider>
              <CloudSyncProvider>
                <UpgradeProvider>
                  <AppHeader />
                  <AppRouter />
                  <OfflineIndicator />
                  {/* Version indicator - visible in dev/debug */}
                  <div className="fixed bottom-2 left-2 text-[10px] text-slate-400 opacity-50 hover:opacity-100 transition-opacity z-10">
                    v{BUILD_VERSION}
                  </div>
                </UpgradeProvider>
              </CloudSyncProvider>
            </OrganizationProvider>
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="bottom-left" richColors closeButton />
      {showUpdate && <UpdateNotification onRefresh={handleRefresh} />}
    </div>
  );
}

export default App;
