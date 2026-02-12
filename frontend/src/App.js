import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SyncProvider } from "./contexts/SyncContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { CloudSyncProvider } from "./contexts/CloudSyncContext";
import ProtectedRoute from "./components/ProtectedRoute";
import OfflineIndicator from "./components/OfflineIndicator";
import AppHeader from "./components/AppHeader";
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
// Coach Role Pages
import CoachDashboard from "./pages/CoachDashboard";
import CoachDevelopment from "./pages/CoachDevelopment";
import CoachSessions from "./pages/CoachSessions";
import CoachSessionDetail from "./pages/CoachSessionDetail";
import CoachMyProfile from "./pages/CoachMyProfile";
// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminCreateClub from "./pages/AdminCreateClub";
import AdminCreateUser from "./pages/AdminCreateUser";
import AdminClubDetails from "./pages/AdminClubDetails";
// Admin Tools
import DataRecovery from "./pages/DataRecovery";
import "./App.css";

// Role-based home redirect component
function HomeRedirect() {
  const { user, isCoachDeveloper, isAdmin } = useAuth();
  
  // Admin goes to admin dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  
  // Coach role goes to coach dashboard
  if (user?.role === 'coach') {
    return <Navigate to="/coach" replace />;
  }
  
  // Coach Developer goes to main home page
  return <HomePage />;
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
      
      {/* Home - role-based redirect */}
      <Route path="/" element={
        <ProtectedRoute>
          <HomeRedirect />
        </ProtectedRoute>
      } />
      
      {/* Coach Role Routes */}
      <Route path="/coach" element={
        <ProtectedRoute requireCoach>
          <CoachDashboard />
        </ProtectedRoute>
      } />
      <Route path="/coach/development" element={
        <ProtectedRoute requireCoach>
          <CoachDevelopment />
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
        <ProtectedRoute requireCoachDeveloper>
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
      <Route path="/coach-view/:coachId" element={
        <ProtectedRoute requireCoachDeveloper>
          <CoachView />
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

function App() {
  return (
    <div className="App min-h-screen bg-slate-50">
      <BrowserRouter>
        <AuthProvider>
          <SyncProvider>
            <OrganizationProvider>
              <CloudSyncProvider>
                <AppHeader />
                <AppRouter />
                <OfflineIndicator />
              </CloudSyncProvider>
            </OrganizationProvider>
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default App;
