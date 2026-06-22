// Purpose: Persistent top navigation bar.

import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Code2, LogOut, Menu, X } from 'lucide-react';
import { logout } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    try { await logout(); } finally {
      setAuth({ isLoggedIn: false, isAdmin: false, isLoading: false, user: null });
      navigate('/');
      setMobileOpen(false);
    }
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-[var(--accent-light)] text-[var(--accent)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
    }`;

  const initials = auth.user
    ? `${(auth.user.firstname || '')[0] || ''}${(auth.user.lastname || '')[0] || ''}`.toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] glass">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center transition-transform group-hover:scale-105">
            <Code2 size={16} className="text-white" />
          </div>
          <span className="font-bold text-base text-[var(--text-primary)]">CodeArena</span>
        </Link>

        {/* Center Nav — desktop */}
        <nav className="hidden md:flex items-center gap-0.5">
          <NavLink className={linkClass} to="/problems">Problems</NavLink>
          <NavLink className={linkClass} to="/leaderboard">Leaderboard</NavLink>
        </nav>

        {/* Right — desktop */}
        <div className="hidden md:flex items-center gap-2">
          {auth.isLoggedIn ? (
            <>
              <NavLink className={linkClass} to="/profile">Profile</NavLink>
              <div className="flex items-center gap-2 ml-1 pl-3 border-l border-[var(--border)]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className="text-sm text-[var(--text-secondary)] hidden lg:block">
                  {auth.user?.firstname}
                </span>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Logout"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-outline text-sm py-1.5">
                Sign in
              </NavLink>
              <NavLink to="/register" className="btn btn-primary text-sm py-1.5">
                Register
              </NavLink>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 space-y-1 animate-fade-in">
          <NavLink className={linkClass} to="/problems" onClick={() => setMobileOpen(false)}>Problems</NavLink>
          <NavLink className={linkClass} to="/leaderboard" onClick={() => setMobileOpen(false)}>Leaderboard</NavLink>
          {auth.isLoggedIn ? (
            <>
              <NavLink className={linkClass} to="/profile" onClick={() => setMobileOpen(false)}>Profile</NavLink>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <div className="flex gap-2 pt-1">
              <Link to="/login" className="btn btn-outline text-sm py-1.5 flex-1" onClick={() => setMobileOpen(false)}>Sign in</Link>
              <Link to="/register" className="btn btn-primary text-sm py-1.5 flex-1" onClick={() => setMobileOpen(false)}>Register</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
