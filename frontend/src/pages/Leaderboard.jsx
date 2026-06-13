// Purpose: Leaderboard page with podium cards for top 3 and ranked table.
// All existing API logic (getLeaderboard) preserved — only UI changed.

import { useEffect, useState } from 'react';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Trophy, Medal, Award } from 'lucide-react';

const podiumColors = [
  { bg: 'bg-yellow-900/20', border: 'border-yellow-500/50', text: 'text-yellow-400', icon: Trophy },
  { bg: 'bg-slate-700/20', border: 'border-slate-400/50', text: 'text-slate-300', icon: Medal },
  { bg: 'bg-orange-900/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: Award },
];

const Leaderboard = () => {
  const { auth } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/api/user/leaderboard');
        setRows(res.data || []);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load leaderboard');
      }
    };
    load();
  }, []);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const currentUserName = auth.user
    ? `${auth.user.firstname} ${auth.user.lastname}`
    : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Leaderboard</h1>
          <p className="mt-1 text-[var(--text-secondary)]">Top problem solvers</p>
        </div>
        <div className="flex gap-1 bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] p-1">
          {['all', 'week'].map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeFilter === t
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t === 'all' ? 'All Time' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400 mb-6">{error}</div>
      )}

      {/* Podium — Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {top3.map((user, idx) => {
            const { bg, border, text, icon: Icon } = podiumColors[idx];
            const initials = (user.username || '')
              .split(' ')
              .map((w) => w[0] || '')
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={idx}
                className={`card ${bg} border ${border} p-6 text-center animate-slide-up`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <Icon size={32} className={`mx-auto ${text}`} />
                <div className={`mt-1 text-2xl font-bold ${text}`}>#{idx + 1}</div>
                <div className="mt-3 w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-lg font-bold mx-auto">
                  {initials}
                </div>
                <div className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{user.username}</div>
                <div className="text-sm text-[var(--text-secondary)]">{user.problemsSolved} problems solved</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[60px_40px_1fr_120px] gap-4 px-4 py-3 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <div>Rank</div>
          <div></div>
          <div>User</div>
          <div className="text-right">Solved</div>
        </div>
        {rest.map((r, idx) => {
          const rank = idx + 4;
          const isCurrentUser = r.username === currentUserName;
          const initials = (r.username || '')
            .split(' ')
            .map((w) => w[0] || '')
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={idx}
              className={`grid grid-cols-[60px_40px_1fr_120px] gap-4 px-4 py-3 items-center border-b border-[var(--border)] last:border-b-0 transition-colors ${
                isCurrentUser
                  ? 'bg-[var(--accent-light)] border-l-2 border-l-[var(--accent)]'
                  : idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-primary)]'
              }`}
            >
              <div className="text-sm font-medium text-[var(--text-secondary)]">#{rank}</div>
              <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                {initials}
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {r.username}
                {isCurrentUser && <span className="ml-2 text-xs text-[var(--accent)]">(You)</span>}
              </div>
              <div className="text-sm text-right font-semibold text-[var(--text-primary)]">
                {r.problemsSolved}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="px-4 py-12 text-center text-[var(--text-secondary)]">No data yet</div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
