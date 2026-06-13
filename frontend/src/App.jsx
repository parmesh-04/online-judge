// ═══════════════════════════════════════════════════════════════════════
// frontend/src/App.jsx — Main application component with routing
// ═══════════════════════════════════════════════════════════════════════
//
// This is the root component that defines the entire app's page structure.
// It uses React Router v6 for client-side routing and renders a persistent
// Navbar on every page.
//
// Route structure:
//   /              → Home page (landing with features showcase)
//   /login         → Login form (public)
//   /register      → Registration form (public)
//   /problems      → Problem list with filtering (public, but submit requires auth)
//   /problems/:id  → Problem detail page with Monaco editor (public view, auth to submit)
//   /profile       → User profile with submission history (requires auth — redirects to login)
//   /leaderboard   → Global leaderboard ranked by solved problems (public)
//
// Auth is NOT enforced at the route level here — each page handles its own
// auth checks internally (e.g., Profile redirects to /login if no cookie).
// This keeps routing simple and avoids a global auth wrapper.
//
// Global state management uses React Context API (see context/AuthContext.jsx)
// rather than Redux — appropriate for the auth-only global state we need.
//
// Toast notifications use react-hot-toast for non-blocking feedback.
// ═══════════════════════════════════════════════════════════════════════

import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Problems from './pages/Problems.jsx';
import ProblemDetail from './pages/ProblemDetails.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

const App = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* ── Global Toast Notifications ── */}
      {/* Appears in top-right corner. Styled to match the dark theme. */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
      />

      {/* ── Persistent Navbar ── */}
      {/* Rendered outside <Routes> so it appears on every page */}
      <Navbar />

      {/* ── Page Routes ── */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/problems" element={<Problems />} />
        <Route path="/problems/:id" element={<ProblemDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </div>
  );
};

export default App;
