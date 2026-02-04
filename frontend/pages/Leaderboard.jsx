import { useEffect, useState } from 'react';
import { API } from '../api/client';

const Leaderboard = () => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold text-slate-100">Leaderboard</h2>

      {error ? <div className="mt-4 text-red-300 text-sm">{error}</div> : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/50">
            <tr>
              <th className="px-4 py-3 text-slate-200">User</th>
              <th className="px-4 py-3 text-slate-200">Solved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-800">
                <td className="px-4 py-3 text-slate-100">{r.username}</td>
                <td className="px-4 py-3 text-slate-100">{r.problemsSolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;
