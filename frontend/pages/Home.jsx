import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-100">Online Judge</h1>
      <p className="mt-2 text-slate-300">
        Solve problems, run code, submit solutions, and track your progress.
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          to="/problems"
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
        >
          Browse Problems
        </Link>
        <Link
          to="/login"
          className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-sm"
        >
          Login
        </Link>
      </div>
    </div>
  );
};

export default Home;
