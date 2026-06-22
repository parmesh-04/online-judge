// Purpose: Profile page — LeetCode-style stats, heatmap, and recent submissions.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { Award, Code2, CheckCircle2, TrendingUp, Calendar, ExternalLink } from 'lucide-react';

const heatmapColor = (count) => {
  if (!count) return 'var(--bg-surface-hover)';
  if (count <= 1) return '#0e4429';
  if (count <= 3) return '#006d32';
  if (count <= 5) return '#26a641';
  return '#39d353';
};

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

const verdictColor = (v) => {
  const s = String(v);
  if (s.includes('Accepted')) return { text: 'Accepted', cls: 'text-green-400', bg: 'bg-green-500/10' };
  if (s.includes('Wrong')) return { text: 'Wrong Answer', cls: 'text-red-400', bg: 'bg-red-500/10' };
  if (s.includes('Time Limit')) return { text: 'Time Limit', cls: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  if (s.includes('Compile')) return { text: 'Compile Error', cls: 'text-orange-400', bg: 'bg-orange-500/10' };
  return { text: 'Runtime Error', cls: 'text-red-400', bg: 'bg-red-500/10' };
};

const langColor = (lang) => {
  switch ((lang || '').toLowerCase()) {
    case 'cpp': return 'text-blue-400';
    case 'py': case 'python': return 'text-yellow-400';
    case 'java': return 'text-orange-400';
    case 'javascript': return 'text-green-400';
    default: return 'text-[var(--text-muted)]';
  }
};

const ProfileInner = () => {
  const { auth } = useAuth();
  const user = auth.user;

  const initials = user
    ? `${(user.firstname || '')[0] || ''}${(user.lastname || '')[0] || ''}`.toUpperCase()
    : '';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const heatmapGrid = useMemo(() => {
    const map = {};
    (user?.submissionHeatmap || []).forEach((d) => { map[d._id] = d.count; });
    const cells = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      cells.push({ date: key, count: map[key] || 0 });
    }
    return cells;
  }, [user?.submissionHeatmap]);

  const stats = [
    { icon: CheckCircle2, label: 'Solved', value: user?.totalSolved ?? 0, color: 'text-green-400', bg: 'bg-green-500/10' },
    { icon: Code2, label: 'Submissions', value: user?.totalSubmissions ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: TrendingUp, label: 'Success Rate', value: `${user?.successRate ?? 0}%`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: Award, label: 'Best Rank', value: '#—', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      {/* Profile Header Card */}
      <div className="card p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-[var(--bg-surface)]" title="Active" />
        </div>

        {/* Info */}
        <div className="text-center sm:text-left flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {user?.firstname} {user?.lastname}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">{user?.email}</p>
          {memberSince && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--text-muted)] justify-center sm:justify-start">
              <Calendar size={12} />
              Member since {memberSince}
            </div>
          )}
        </div>

        {/* Actions */}
        <Link to="/problems" className="btn btn-primary text-sm py-1.5 shrink-0">
          Solve Problems
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card p-4 text-center hover:scale-[1.02] transition-transform">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon size={18} className={color} />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Submission Activity</h3>
          <span className="text-xs text-[var(--text-muted)]">Last 12 weeks</span>
        </div>
        <div className="flex flex-wrap gap-[3px]">
          {heatmapGrid.map((cell) => (
            <div
              key={cell.date}
              className="w-3 h-3 rounded-sm transition-colors cursor-default"
              style={{ backgroundColor: heatmapColor(cell.count) }}
              title={`${cell.date}: ${cell.count} submission${cell.count !== 1 ? 's' : ''}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>Less</span>
          {[0, 1, 3, 5, 8].map((n) => (
            <div key={n} className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatmapColor(n) }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Submissions</h3>
          {(user?.recentSubmissions || []).length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">{user.recentSubmissions.length} submissions</span>
          )}
        </div>

        {(user?.recentSubmissions || []).length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Code2 size={32} className="mx-auto text-[var(--border)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No submissions yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Solve your first problem to see it here</p>
            <Link to="/problems" className="btn btn-primary text-sm mt-4 inline-flex">Browse Problems</Link>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_130px_70px_80px] gap-4 px-5 py-2.5 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)]">
              <div>Problem</div>
              <div>Verdict</div>
              <div>Lang</div>
              <div className="text-right">Time</div>
            </div>
            {(user?.recentSubmissions || []).map((s, idx) => {
              const v = verdictColor(s.verdict);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_130px_70px_80px] gap-4 px-5 py-3 items-center border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <div className="text-sm text-[var(--text-primary)] truncate">
                    {s.problemId?.title || 'Unknown Problem'}
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.cls} ${v.bg}`}>
                      {v.text}
                    </span>
                  </div>
                  <div className={`text-xs font-mono font-medium ${langColor(s.language)}`}>
                    {s.language?.toUpperCase()}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] text-right">{timeAgo(s.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Profile = () => (
  <ProtectedRoute>
    <ProfileInner />
  </ProtectedRoute>
);

export default Profile;
