// Purpose: Leaderboard — LeetCode-style ranked list with podium highlight.

import { useEffect, useState } from 'react';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Trophy, Medal, Star, ChevronUp } from 'lucide-react';

const Leaderboard = () => {
  const { auth } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/api/user/leaderboard');
        setRows(res.data || []);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currentUserName = auth.user
    ? `${auth.user.firstname} ${auth.user.lastname}`
    : '';

  const getInitials = (name) =>
    (name || '').split(' ').map((w) => w[0] || '').join('').toUpperCase().slice(0, 2);

  const rankStyle = (idx) => {
    if (idx === 0) return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: '#1' };
    if (idx === 1) return { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-400/30', label: '#2' };
    if (idx === 2) return { icon: Star, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: '#3' };
    return null;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Leaderboard</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Top problem solvers on CodeArena — ranked by problems solved.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400 mb-6">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {rows.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {rows.slice(0, 3).map((user, idx) => {
                const s = rankStyle(idx);
                const Icon = s.icon;
                return (
                  <div
                    key={idx}
                    className={`card ${s.bg} border ${s.border} p-5 text-center animate-slide-up ${idx === 0 ? 'md:scale-105' : ''}`}
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  >
                    <Icon size={22} className={`mx-auto ${s.color} mb-1`} />
                    <div className={`text-lg font-bold ${s.color}`}>{s.label}</div>
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white text-sm font-bold mx-auto mt-2`}>
                      {getInitials(user.username)}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)] truncate">{user.username}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{user.problemsSolved} solved</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Rankings Table */}
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[56px_40px_1fr_110px] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)]">
              <div>Rank</div>
              <div />
              <div>User</div>
              <div className="text-right">Solved</div>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-[var(--text-secondary)]">
                No participants yet — be the first!
              </div>
            ) : (
              rows.map((r, idx) => {
                const isCurrentUser = r.username === currentUserName;
                const isTop3 = idx < 3;
                const s = rankStyle(idx);

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[56px_40px_1fr_110px] gap-4 px-5 py-3.5 items-center border-b border-[var(--border)] last:border-b-0 transition-colors ${
                      isCurrentUser
                        ? 'bg-[var(--accent-light)] border-l-2 border-l-[var(--accent)]'
                        : 'hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center gap-1">
                      {isTop3 && s ? (
                        <span className={`text-sm font-bold ${s.color}`}>{idx + 1}</span>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">{idx + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isCurrentUser
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--border)] text-[var(--text-secondary)]'
                    }`}>
                      {getInitials(r.username)}
                    </div>

                    {/* Name */}
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCurrentUser ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                        {r.username}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-medium">You</span>
                      )}
                      {idx === 0 && (
                        <ChevronUp size={14} className="text-yellow-400" />
                      )}
                    </div>

                    {/* Solved */}
                    <div className="text-right">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{r.problemsSolved}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-1">problems</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
