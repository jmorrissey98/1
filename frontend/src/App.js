import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
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
import "./App.css";

function App() {
  return (
    <div className="App min-h-screen bg-slate-50">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/new" element={<SessionSetup />} />
          <Route path="/session/:sessionId/setup" element={<SessionSetup />} />
          <Route path="/session/:sessionId/observe" element={<LiveObservation />} />
          <Route path="/session/:sessionId/review" element={<ReviewSession />} />
          <Route path="/templates" element={<TemplateManager />} />
          <Route path="/coaches" element={<MyCoaches />} />
          <Route path="/coaches/:coachId" element={<CoachProfile />} />
          <Route path="/calendar" element={<SessionCalendar />} />
          <Route path="/settings" element={<UserSettings />} />
          <Route path="/coach-view/:coachId" element={<CoachView />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default App;
