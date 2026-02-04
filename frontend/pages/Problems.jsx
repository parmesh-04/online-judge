import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllProblems } from '../api/problems';

const Problems = () => {
  const [problems, setProblems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadProblems = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await getAllProblems(page, 10); // 10 problems per page
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

  const handlePageChange = (page) => {
    loadProblems(page);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold text-slate-100">Problems</h2>

      {error ? <div className="mt-4 text-red-300 text-sm">{error}</div> : null}
      {loading ? <div className="mt-4 text-slate-300">Loading...</div> : null}

      <div className="mt-6 grid gap-3">
        {problems.map((p) => (
          <Link
            key={p._id}
            to={`/problems/${p._id}`}
            className="block rounded-lg border border-slate-800 bg-slate-950/30 p-4 hover:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div className="text-slate-100 font-medium">
                {p.title}
              </div>
              <div className="text-xs text-slate-300">Difficulty: {p.difficulty}</div>
            </div>
            {p.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-slate-300 text-sm">
            Showing {pagination.currentPage} of {pagination.totalPages} pages 
            ({pagination.totalProblems} total problems)
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="px-3 py-1 rounded bg-slate-800 text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-8 h-8 rounded text-sm ${
                    page === currentPage
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1 rounded bg-slate-800 text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
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
