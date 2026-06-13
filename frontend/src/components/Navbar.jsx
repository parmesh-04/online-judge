// Purpose: Persistent top navigation bar displayed on all pages.
// Shows logo, nav links, and auth status with a glassmorphism design.

import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Code2, LogOut } from 'lucide-react';
import { logout } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      setAuth({ isLoggedIn: false, isAdmin: false, isLoading: false, user: null });
      navigate('/');
    }
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'bg-[var(--accent-light)] text-[var(--accent-hover)]'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
    }`;

  const initials = auth.user
    ? `${(auth.user.firstname || '')[0] || ''}${(auth.user.lastname || '')[0] || ''}`.toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] glass">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <Code2 size={24} className="text-[var(--accent)]" />
          <span className="font-bold text-xl gradient-text">CodeArena</span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink className={linkClass} to="/problems">
            Problems
          </NavLink>
          <NavLink className={linkClass} to="/leaderboard">
            Leaderboard
          </NavLink>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {auth.isLoggedIn ? (
            <>
              <NavLink className={linkClass} to="/profile">
                Profile
              </NavLink>
              <div className="flex items-center gap-2 ml-2">
                {/* Avatar circle with initials */}
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-semibold">
                  {initials}
                </div>
                <span className="text-sm text-[var(--text-secondary)] hidden sm:inline">
                  {auth.user?.firstname}
                </span>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors duration-200"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="btn btn-outline text-sm"
              >
                Login
              </NavLink>
              <NavLink
                to="/register"
                className="btn btn-primary text-sm"
              >
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
