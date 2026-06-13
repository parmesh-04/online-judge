// Purpose: Landing/Home page with hero section, stats bar, and feature cards.

import { Link } from 'react-router-dom';
import { Shield, Brain, Trophy, Code2, Zap, Users } from 'lucide-react';

const Home = () => {
  return (
    <div className="gradient-bg min-h-[calc(100vh-60px)]">
      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)] mb-8">
          <Zap size={14} className="text-yellow-400" />
          Powered by Docker Sandboxing & Gemini AI
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
          <span className="gradient-text">Code. Compete.</span>
          <br />
          <span className="text-[var(--text-primary)]">Conquer.</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          Practice algorithmic problems in C++, Python, Java and JavaScript
          with real-time AI-powered debugging and Docker-sandboxed execution.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to="/problems"
            className="btn btn-primary text-base px-8 py-3 text-base font-semibold"
          >
            Start Solving →
          </Link>
          <Link
            to="/leaderboard"
            className="btn btn-outline text-base px-8 py-3"
          >
            View Leaderboard
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mx-auto max-w-4xl px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: Code2, label: '500+ Problems', desc: 'Curated challenges' },
            { icon: Users, label: '10,000+ Submissions', desc: 'Active community' },
            { icon: Brain, label: 'AI-Powered Hints', desc: 'Gemini integration' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="card p-5 text-center">
              <Icon size={24} className="mx-auto text-[var(--accent)]" />
              <div className="mt-3 text-xl font-bold text-[var(--text-primary)]">{label}</div>
              <div className="text-sm text-[var(--text-secondary)]">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-10">
          Built for serious competitive programmers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="card p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-green-900/30 flex items-center justify-center">
              <Shield size={24} className="text-green-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Secure Sandbox</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              Every submission runs in an isolated Docker container with strict memory, CPU, and network limits. No code escapes.
            </p>
          </div>

          <div className="card p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-purple-900/30 flex items-center justify-center">
              <Brain size={24} className="text-purple-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">AI Debugger</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              Stuck on a bug? Our Gemini-powered AI analyzes your code, pinpoints the issue, and suggests fixes in real-time.
            </p>
          </div>

          <div className="card p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-yellow-900/30 flex items-center justify-center">
              <Trophy size={24} className="text-yellow-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Live Leaderboard</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              Compete with fellow programmers. Track your progress, climb the ranks, and showcase your problem-solving skills.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
