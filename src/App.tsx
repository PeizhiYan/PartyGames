import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';
import { backend } from './services';
import AdminPage from './pages/AdminPage';
import GameLobbyPage from './pages/GameLobbyPage';
import GomokuSoloPage from './pages/GomokuSoloPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NoAccessPage from './pages/NoAccessPage';
import PrivacyPage from './pages/PrivacyPage';
import RoomPage from './pages/RoomPage';
import RoomsPage from './pages/RoomsPage';
import SettingsPage from './pages/SettingsPage';

/** The one-player screen for whichever game supports it. */
function SoloGame() {
  const { game } = useParams();
  if (game === 'gomoku') return <GomokuSoloPage />;
  return <Navigate to={game ? `/g/${game}` : '/'} replace />;
}

/** Records this visit once per app start, so the admin's user list shows who plays. */
function VisitRecorder() {
  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    backend.account.recordVisit({ installed })
      .catch((e) => console.error('PartyGames: could not record visit', e));
  }, []);
  return null;
}

export default function App() {
  const { state } = useAuth();
  const { pathname } = useLocation();

  // The privacy policy is public, so it's shown whatever the sign-in state.
  if (pathname === '/privacy') return <PrivacyPage />;

  if (state.status === 'loading') {
    return (
      <div className="center-screen">
        <img src="/icon.svg" alt="Loading PartyGames" width={72} height={72} className="pulse" />
      </div>
    );
  }
  if (state.status === 'signedOut') return <LoginPage />;
  if (state.status === 'denied' || state.status === 'error') {
    return <NoAccessPage email={state.user.email} error={state.status === 'error' ? state.message : undefined} />;
  }

  return (
    // Keyed by user so nothing from a previous account survives a sign-in switch.
    <div key={state.user.uid}>
      <VisitRecorder />
      <Routes>
        {/* A room, or a one-player game, fills the screen: no tab bar in the way of the board.
            "solo" is a static segment, so it wins over :roomId whatever the order here. */}
        <Route path="/g/:game/solo" element={<SoloGame />} />
        <Route path="/g/:game/:roomId" element={<RoomPage />} />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="g/:game" element={<GameLobbyPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {state.isAdmin && <Route path="admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  );
}
