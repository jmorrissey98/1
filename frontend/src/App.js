import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import HomePage from "./pages/HomePage";
import SessionSetup from "./pages/SessionSetup";
import LiveObservation from "./pages/LiveObservation";
import ReviewSession from "./pages/ReviewSession";
import TemplateManager from "./pages/TemplateManager";
import MyCoaches from "./pages/MyCoaches";
import CoachProfile from "./pages/CoachProfile";
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
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default App;
