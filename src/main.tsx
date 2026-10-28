import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './hooks/useAuth';
// Imported for its side effect: it has to catch `beforeinstallprompt`, which fires once and early.
import './hooks/useInstall';
import { backendInitError } from './services';
import './styles/global.css';

registerSW({ immediate: true });

// iOS Safari ignores `user-scalable=no` in the viewport meta, so block its pinch gesture directly.
// Only on touch devices, so trackpad zoom on a Mac still works.
if (navigator.maxTouchPoints > 0) {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// In the installed app, iOS still lets an edge swipe go back (left edge) or forward (right edge)
// through history, which makes it feel like a web page. CSS (overscroll-behavior, touch-action)
// can't stop that, but cancelling touches that start at the edge can. Only in standalone mode, so
// a normal browser tab keeps its usual navigation. The strips are kept narrow because taps that
// start inside them won't produce a click.
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
if (isStandalone && navigator.maxTouchPoints > 0) {
  const EDGE_SWIPE_ZONE_PX = 20;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      if (x < EDGE_SWIPE_ZONE_PX || x > window.innerWidth - EDGE_SWIPE_ZONE_PX) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
}

const root = createRoot(document.getElementById('root')!);

if (backendInitError) {
  root.render(
    <div className="center-screen">
      <div className="narrow">
        <h1>Setup needed</h1>
        <p className="error">{backendInitError.message}</p>
      </div>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
