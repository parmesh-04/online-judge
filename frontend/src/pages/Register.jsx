import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, getUserStats } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

const Register = () => {
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  // Real-time password requirement checks
  const checks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const passwordValid = checks.length && checks.uppercase && checks.number;

  const friendlyError = (msg) => {
    if (!msg) return 'Registration failed. Please try again.';
    if (msg.includes('already exists')) return 'An account with this email already exists. Try logging in instead.';
    if (msg.includes('password')) return 'Password too weak — must be at least 6 characters with one uppercase letter and one number.';
    if (msg.includes('email')) return 'Please enter a valid email address.';
    if (msg.includes('required')) return 'Please fill in all fields.';
    return msg;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!passwordValid) {
      setError('Please fix your password before submitting — it must have 6+ chars, one uppercase letter, and one number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await register(email, password, firstname, lastname);
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

  const Req = ({ ok, label }) => (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-8">
      <div className="card p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-light)] flex items-center justify-center mx-auto mb-4">
            <UserPlus size={24} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Create account</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Join CodeArena — it's free. Start solving in seconds.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">First name</label>
              <input
                className="input-field"
                placeholder="John"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Last name</label>
              <input
                className="input-field"
                placeholder="Doe"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                required
              />
            </div>
          </div>

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
                placeholder="Create a strong password"
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
            {/* Password requirements checklist */}
            {password.length > 0 && (
              <div className="mt-2 flex gap-4 flex-wrap">
                <Req ok={checks.length} label="6+ characters" />
                <Req ok={checks.uppercase} label="Uppercase letter" />
                <Req ok={checks.number} label="One number" />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full py-2.5"
            type="submit"
            disabled={loading}
          >
            {loading ? <span className="spinner"></span> : null}
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
