import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUserStats } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

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
      setError(err?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h2 className="text-2xl font-semibold text-slate-100">Login</h2>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-800 text-slate-100"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-800 text-slate-100"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        <button
          className="w-full px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          type="submit"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
