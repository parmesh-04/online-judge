import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getUserStats } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const friendlyError = (msg) => {
    if (!msg) return 'Login failed. Please try again.';
    if (msg.includes('invalid credentials') || msg.includes('Invalid')) {
      return 'Incorrect email or password. Double-check your details or create a new account.';
    }
    if (msg.includes('complete details') || msg.includes('required')) {
      return 'Please enter both your email and password.';
    }
    return msg;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      const me = await getUserStats();
      setAuth({
        isLoggedIn: true,
        isAdmin: me?.data?.role === 'admin',
        isLoading: false,
        user: me.data,
      });
      navigate('/problems');
    } catch (err) {
      setError(friendlyError(err?.response?.data?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-light)] flex items-center justify-center mx-auto mb-4">
            <LogIn size={24} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in to your CodeArena account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
            <input
              className="input-field"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
            <div className="relative">
              <input
                className="input-field pr-10"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">
              {error}
              {error.includes('create a new account') && (
                <div className="mt-2">
                  <Link to="/register" className="text-[var(--accent)] hover:underline font-medium">
                    Create a free account →
                  </Link>
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-primary w-full py-2.5"
            type="submit"
            disabled={loading}
          >
            {loading ? <span className="spinner"></span> : null}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-4 p-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-secondary)]">Demo account: </span>
          arjun@codearena.dev / Demo@123456
        </div>

        <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">
            Create one — it's free
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
