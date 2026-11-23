import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { getSocket } from './lib/socket.js';
import { Spinner, useToast } from './components/ui.jsx';
import AuthPage from './pages/AuthPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import TeamLayout from './pages/TeamLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import MembersPage from './pages/MembersPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?._id;
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    if (!socket) return;
    const shown = new Set();
    const notify = (alert) => {
      if (alert?.kind !== 'scheduled-meeting') return;
      if (!shown.has(alert.meetingId)) {
        shown.add(alert.meetingId);
        const when = new Date(alert.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        toast(`${alert.title} — ${alert.body} · ${when}`, { icon: 'calendar' });
      }
      socket.emit('meeting:alert-seen', alert.meetingId);
    };
    socket.on('notify', notify);
    return () => socket.off('notify', notify);
  }, [userId, toast]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={<Protected><TeamsPage /></Protected>} />
      <Route path="/teams/:teamId" element={<Protected><TeamLayout /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="members" element={<MembersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
