// Purpose: Problems listing page — LeetCode-style table with filters.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, Circle, Lock, ArrowRight } from 'lucide-react';
import { getAllProblems } from '../api/problems';
import { useAuth } from '../context/AuthContext';

const diffLabel = (d) => {
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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { loadProblems(); }, []);

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

  const diffCount = {
    Easy: problems.filter(p => Number(p.difficulty) <= 1).length,
    Medium: problems.filter(p => Number(p.difficulty) === 2).length,
    Hard: problems.filter(p => Number(p.difficulty) >= 3).length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Problems</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {pagination?.totalProblems ?? problems.length} problems available
          {auth.isLoggedIn && solvedSet.size > 0 && ` · ${solvedSet.size} solved`}
        </p>
      </div>

      {/* Guest Banner */}
      {!auth.isLoggedIn && (
        <div className="mb-6 p-4 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-light)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-[var(--accent)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Sign in to track your progress</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Submit solutions, see your solved problems, use AI hints, and compete on the leaderboard.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/login" className="btn btn-outline text-sm py-1.5">Sign in</Link>
            <Link to="/register" className="btn btn-primary text-sm py-1.5">
              Register free <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input-field pl-9"
            placeholder="Search problems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Difficulty tabs */}
        <div className="flex gap-1 bg-[var(--bg-surface)] rounded-lg border border-[var(--border)] p-1 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setDiffFilter(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                diffFilter === tab
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab}
              {tab !== 'All' && (
                <span className={`ml-1.5 text-[10px] ${diffFilter === tab ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                  {diffCount[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[32px_1fr_90px_1fr_32px] gap-4 px-5 py-2.5 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)]">
          <div />
          <div>Title</div>
          <div>Difficulty</div>
          <div>Topics</div>
          <div />
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--border)]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-5 py-4 grid grid-cols-[32px_1fr_90px_1fr_32px] gap-4 items-center">
                <div className="skeleton h-4 w-4 rounded-full" />
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-5 w-14 rounded-full" />
                <div className="skeleton h-4 w-1/2" />
                <div />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[var(--text-secondary)]">No problems match your search.</p>
            <button onClick={() => { setSearch(''); setDiffFilter('All'); }} className="text-xs text-[var(--accent)] mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((p, idx) => {
              const isSolved = solvedSet.has(p._id);
              const dl = diffLabel(p.difficulty);
              return (
                <Link
                  key={p._id}
                  to={`/problems/${p._id}`}
                  className={`grid grid-cols-[32px_1fr_90px_1fr_32px] gap-4 px-5 py-3.5 items-center transition-all duration-150 hover:bg-[var(--bg-surface-hover)] border-l-2 border-l-transparent hover:border-l-[var(--accent)] group ${
                    isSolved ? 'border-l-green-500/30' : ''
                  }`}
                >
                  {/* Status icon */}
                  <div>
                    {isSolved ? (
                      <CheckCircle2 size={15} className="text-green-400" />
                    ) : (
                      <Circle size={15} className="text-[var(--border)]" />
                    )}
                  </div>

                  {/* Title */}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate block">
                      {idx + 1}. {p.title}
                    </span>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <span className={`badge ${dl.cls}`}>{dl.text}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {(p.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)] whitespace-nowrap">
                        {t}
                      </span>
                    ))}
                    {(p.tags || []).length > 3 && (
                      <span className="text-[10px] text-[var(--text-muted)]">+{p.tags.length - 3}</span>
                    )}
                  </div>

                  {/* Arrow on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)]">
                    <ArrowRight size={14} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalProblems} problems
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => loadProblems(currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="btn btn-outline text-sm py-1.5"
            >
              ← Prev
            </button>
            <button
              onClick={() => loadProblems(currentPage + 1)}
              disabled={!pagination.hasNext}
              className="btn btn-outline text-sm py-1.5"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Problems;
