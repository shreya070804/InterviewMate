import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Auth } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { InterviewRoom } from './pages/InterviewRoom';
import { FeedbackDetails } from './pages/FeedbackDetails';
import { History } from './pages/History';
import { Leaderboard } from './pages/Leaderboard';
import { NotFound } from './pages/NotFound';
import { SkillGapTracker } from './pages/SkillGapTracker';
import { SoloInterview } from './pages/SoloInterview';
import { AdminDashboard } from './pages/AdminDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Auth Route */}
          <Route path="/auth" element={<Auth />} />

          {/* Onboarding Route - requires auth, but not profile-onboarded */}
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute requireOnboarded={false}>
                <Onboarding />
              </ProtectedRoute>
            } 
          />

          {/* Dashboard Route */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          {/* History Route */}
          <Route 
            path="/history" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <History />
              </ProtectedRoute>
            } 
          />

          {/* Leaderboard Route */}
          <Route 
            path="/leaderboard" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <Leaderboard />
              </ProtectedRoute>
            } 
          />

          {/* Live Interview Room Route */}
          <Route 
            path="/room/:sessionId" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <InterviewRoom />
              </ProtectedRoute>
            } 
          />

          {/* Feedback Review Route */}
          <Route 
            path="/feedback/:sessionId" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <FeedbackDetails />
              </ProtectedRoute>
            } 
          />

          {/* Skill Gap Tracker Route */}
          <Route 
            path="/skills" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <SkillGapTracker />
              </ProtectedRoute>
            } 
          />

          {/* Solo AI Interview Route */}
          <Route 
            path="/solo" 
            element={
              <ProtectedRoute requireOnboarded={true}>
                <SoloInterview />
              </ProtectedRoute>
            } 
          />

          {/* Admin Dashboard Route */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requireOnboarded={true} requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

