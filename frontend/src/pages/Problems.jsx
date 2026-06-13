// Purpose: Problems listing page with search, difficulty filters, and styled table.
// All existing API logic (getAllProblems, pagination) preserved — only UI changed.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, Circle } from 'lucide-react';
import { getAllProblems } from '../api/problems';
import { useAuth } from '../context/AuthContext';

const difficultyLabel = (d) => {
  const n = Number(d);
  if (n <= 1) return { text: 'Easy', cls: 'badge-easy' };
  if (n <= 2) return { text: 'Medium', cls: 'badge-medium' };
  return { text: 'Hard', cls: 'badge-hard' };
};

const Problems = () => {
  const { auth } = useAuth();
  const [problems, setProblems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('All');

  const solvedSet = new Set(
    (auth.user?.solvedProblems || []).map((p) => (typeof p === 'object' ? p._id : p))
  );

  const loadProblems = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await getAllProblems(page, 50);
      setProblems(res.data.problems || []);
      setPagination(res.data.pagination);
      setCurrentPage(page);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, []);

  // Client-side filtering
  const filtered = problems.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchDiff =
      diffFilter === 'All' ||
      (diffFilter === 'Easy' && Number(p.difficulty) <= 1) ||
      (diffFilter === 'Medium' && Number(p.difficulty) === 2) ||
      (diffFilter === 'Hard' && Number(p.difficulty) >= 3);
    return matchSearch && matchDiff;
  });

  const tabs = ['All', 'Easy', 'Medium', 'Hard'];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">Problems</h1>
      <p className="mt-1 text-[var(--text-secondary)]">Practice makes perfect. Pick a challenge.</p>

      {/* Search & Filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input-field pl-9"
            placeholder="Search problems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setDiffFilter(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                diffFilter === tab
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-4 p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">{error}</div>}

      {loading ? (
        <div className="mt-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 w-full"></div>
          ))}
        </div>
      ) : (
        <div className="mt-6 card overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_100px_200px_40px] gap-4 px-4 py-3 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <div>#</div>
            <div>Title</div>
            <div>Difficulty</div>
            <div>Tags</div>
            <div></div>
          </div>

          {/* Problem Rows */}
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[var(--text-secondary)]">No problems found</div>
          ) : (
            filtered.map((p, idx) => (
              <Link
                key={p._id}
                to={`/problems/${p._id}`}
                className={`grid grid-cols-[40px_1fr_100px_200px_40px] gap-4 px-4 py-3.5 items-center transition-all duration-200 border-l-2 border-l-transparent hover:border-l-[var(--accent)] hover:bg-[var(--bg-surface-hover)] ${
                  idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-primary)]'
                }`}
              >
                <div className="text-sm text-[var(--text-muted)]">{idx + 1}</div>
                <div className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">
                  {p.title}
                </div>
                <div>
                  <span className={`badge ${difficultyLabel(p.difficulty).cls}`}>
                    {difficultyLabel(p.difficulty).text}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(p.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">
                      {t}
                    </span>
                  ))}
                </div>
                <div>
                  {solvedSet.has(p._id) ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                  ) : (
                    <Circle size={16} className="text-[var(--text-muted)]" />
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalProblems} problems)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => loadProblems(currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="btn btn-outline text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => loadProblems(currentPage + 1)}
              disabled={!pagination.hasNext}
              className="btn btn-outline text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Problems;
