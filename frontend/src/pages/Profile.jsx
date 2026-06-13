// Purpose: Profile page with avatar, stats, submission heatmap, and recent submissions.
// Uses data from the enhanced getUserStats endpoint.

import { useMemo } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { Award, Code2, CheckCircle2, TrendingUp } from 'lucide-react';

// GitHub-style contribution heatmap colors (green shades)
const heatmapColor = (count) => {
  if (!count || count === 0) return '#161b22';
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

const ProfileInner = () => {
  const { auth } = useAuth();
  const user = auth.user;

  const initials = user
    ? `${(user.firstname || '')[0] || ''}${(user.lastname || '')[0] || ''}`.toUpperCase()
    : '';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  // Build heatmap grid (12 weeks × 7 days = 84 cells)
  const heatmapGrid = useMemo(() => {
    const map = {};
    (user?.submissionHeatmap || []).forEach((d) => {
      map[d._id] = d.count;
    });

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
    { icon: CheckCircle2, label: 'Problems Solved', value: user?.totalSolved ?? 0, color: 'text-green-400' },
    { icon: Code2, label: 'Total Submissions', value: user?.totalSubmissions ?? 0, color: 'text-blue-400' },
    { icon: TrendingUp, label: 'Success Rate', value: `${user?.successRate ?? 0}%`, color: 'text-purple-400' },
    { icon: Award, label: 'Best Rank', value: '#—', color: 'text-yellow-400' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      {/* Avatar & Info */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold mx-auto">
          {initials}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
          {user?.firstname} {user?.lastname}
        </h1>
        <p className="text-[var(--text-secondary)]">{user?.email}</p>
        {memberSince && (
          <p className="text-sm text-[var(--text-muted)]">Member since {memberSince}</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <Icon size={20} className={`mx-auto ${color}`} />
            <div className="mt-2 text-xl font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
          </div>
        ))}
      </div>

      {/* Submission Heatmap */}
      <div className="card p-5 mb-8">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Submission Activity</h3>
        <div className="flex flex-wrap gap-[3px]">
          {heatmapGrid.map((cell) => (
            <div
              key={cell.date}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: heatmapColor(cell.count) }}
              title={`${cell.date}: ${cell.count} submissions`}
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
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Recent Submissions</h3>
        </div>
        {(user?.recentSubmissions || []).length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--text-muted)]">No submissions yet</div>
        ) : (
          (user?.recentSubmissions || []).map((s, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-[1fr_120px_80px_80px] gap-4 px-4 py-3 items-center border-b border-[var(--border)] last:border-b-0 ${
                idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-primary)]'
              }`}
            >
              <div className="text-sm text-[var(--text-primary)] truncate">
                {s.problemId?.title || 'Unknown Problem'}
              </div>
              <div>
                <span className={`text-xs font-medium ${
                  String(s.verdict).includes('Accepted') ? 'text-green-400' :
                  String(s.verdict).includes('Wrong') ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {String(s.verdict).includes('Accepted') ? '✅ Accepted' :
                   String(s.verdict).includes('Wrong') ? '❌ Wrong' :
                   '⚠️ Error'}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">{s.language}</div>
              <div className="text-xs text-[var(--text-muted)] text-right">{timeAgo(s.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  return (
    <ProtectedRoute>
      <ProfileInner />
    </ProtectedRoute>
  );
};

export default Profile;
