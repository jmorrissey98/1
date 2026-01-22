import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { SyncProvider } from "./contexts/SyncContext";
import ProtectedRoute from "./components/ProtectedRoute";
import OfflineIndicator from "./components/OfflineIndicator";
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
import AuthCallback from "./pages/AuthCallback";
import "./App.css";

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
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/session/new" element={
        <ProtectedRoute>
          <SessionSetup />
        </ProtectedRoute>
      } />
      <Route path="/session/:sessionId/setup" element={
        <ProtectedRoute>
          <SessionSetup />
        </ProtectedRoute>
      } />
      <Route path="/session/:sessionId/observe" element={
        <ProtectedRoute>
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
        <ProtectedRoute>
          <CoachProfile />
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <SessionCalendar />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <UserSettings />
        </ProtectedRoute>
      } />
      <Route path="/coach-view/:coachId" element={
        <ProtectedRoute>
          <CoachView />
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
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default App;
