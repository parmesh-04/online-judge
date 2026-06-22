// frontend/src/pages/Home.jsx
// Landing page — designed to feel human-crafted, not AI-generated.

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, Terminal, Shield, Cpu, Trophy,
  ChevronRight, Sparkles, Code2
} from 'lucide-react';

// Typing animation lines for the hero code block
const CODE_LINES = [
  { text: '#include <bits/stdc++.h>', cls: 'code-preprocessor' },
  { text: 'using namespace std;', cls: 'code-keyword' },
  { text: '', cls: '' },
  { text: 'int main() {', cls: 'code-keyword' },
  { text: '    int n; cin >> n;', cls: 'code-default' },
  { text: '    vector<int> a(n);', cls: 'code-default' },
  { text: '    for (auto &x : a) cin >> x;', cls: 'code-default' },
  { text: '    sort(a.begin(), a.end());', cls: 'code-function' },
  { text: '    cout << a[0] << endl;', cls: 'code-function' },
  { text: '}', cls: 'code-keyword' },
];

const Home = () => {
  const { auth } = useAuth();
  const [stats, setStats] = useState({ problems: 0, users: 0 });
  const [visibleLines, setVisibleLines] = useState(0);

  // Fetch real stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [probRes, lbRes] = await Promise.allSettled([
          API.get('/api/problems?page=1&limit=1'),
          API.get('/api/user/leaderboard'),
        ]);
        setStats({
          problems: probRes.status === 'fulfilled'
            ? (probRes.value.data?.pagination?.totalProblems || 10)
            : 10,
          users: lbRes.status === 'fulfilled'
            ? (lbRes.value.data?.length || 0)
            : 0,
        });
      } catch (_) {}
    };
    fetchStats();
  }, []);

  // Typing animation
  useEffect(() => {
    if (visibleLines < CODE_LINES.length) {
      const timer = setTimeout(() => setVisibleLines(v => v + 1), 280);
      return () => clearTimeout(timer);
    }
  }, [visibleLines]);

  return (
    <div className="min-h-[calc(100vh-60px)] overflow-hidden">
      {/* ── HERO ── */}
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        {/* Subtle grid background */}
        <div className="hero-grid-bg" />

        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
          {/* Left — Copy */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              All systems operational
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              <span className="text-[var(--text-primary)]">Write code.</span>
              <br />
              <span className="text-[var(--text-primary)]">Get </span>
              <span className="gradient-text">instant</span>
              <span className="text-[var(--text-primary)]"> verdicts.</span>
            </h1>

            <p className="mt-5 text-base md:text-lg text-[var(--text-secondary)] leading-relaxed max-w-lg">
              An online judge with Docker-sandboxed execution and AI-powered debugging.
              Submit C++, Python, Java, or JavaScript — get results in seconds.
            </p>

            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <Link
                to="/problems"
                className="btn btn-primary text-base px-6 py-2.5 font-semibold"
              >
                Browse Problems
                <ArrowRight size={16} />
              </Link>
              {!auth.isLoggedIn && (
                <Link
                  to="/register"
                  className="btn btn-outline text-base px-6 py-2.5"
                >
                  Create Free Account
                </Link>
              )}
            </div>

            {/* Micro-stats */}
            <div className="mt-8 flex items-center gap-6 text-sm text-[var(--text-muted)]">
              <span><strong className="text-[var(--text-primary)]">{stats.problems}</strong> problems</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
              <span><strong className="text-[var(--text-primary)]">{stats.users || '—'}</strong> users</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
              <span><strong className="text-[var(--text-primary)]">4</strong> languages</span>
            </div>
          </div>

          {/* Right — Terminal / Code Preview */}
          <div className="animate-slide-up hidden md:block" style={{ animationDelay: '0.15s' }}>
            <div className="terminal-window">
              {/* Title bar */}
              <div className="terminal-titlebar">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs text-[var(--text-muted)] font-mono">solution.cpp</span>
                <div className="w-12" />
              </div>
              {/* Code area */}
              <div className="terminal-body">
                {CODE_LINES.map((line, i) => (
                  <div
                    key={i}
                    className={`terminal-line ${i < visibleLines ? 'visible' : ''}`}
                    style={{ transitionDelay: `${i * 40}ms` }}
                  >
                    <span className="terminal-line-num">{i + 1}</span>
                    <span className={line.cls}>{line.text || '\u00A0'}</span>
                  </div>
                ))}
                {/* Blinking cursor */}
                <div className="terminal-cursor" />
              </div>
              {/* Verdict bar */}
              <div className={`terminal-verdict ${visibleLines >= CODE_LINES.length ? 'show' : ''}`}>
                <span className="text-green-400 font-semibold text-sm">✅ Accepted</span>
                <span className="text-xs text-[var(--text-muted)]">Runtime: 12ms · Memory: 3.2MB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-[var(--text-primary)] mb-3">
            How it works
          </h2>
          <p className="text-center text-sm text-[var(--text-secondary)] mb-12">
            From reading the problem to seeing your verdict — in under a minute.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Pick a problem',
                desc: 'Browse problems by difficulty. Each one has a clear description, sample inputs, and constraints.',
                icon: Code2,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/10',
              },
              {
                step: '02',
                title: 'Write & test your solution',
                desc: 'Code in the built-in Monaco editor. Run against sample inputs to debug before submitting.',
                icon: Terminal,
                color: 'text-green-400',
                bgColor: 'bg-green-500/10',
              },
              {
                step: '03',
                title: 'Submit & get your verdict',
                desc: 'Your code runs against hidden test cases in a secure Docker sandbox. See results instantly.',
                icon: Trophy,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500/10',
              },
            ].map(({ step, title, desc, icon: Icon, color, bgColor }, idx) => (
              <div key={step} className="relative animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <div className="text-xs font-mono text-[var(--text-muted)] mb-1">{step}</div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Shield,
                title: 'Docker sandbox',
                desc: 'Every submission runs in an isolated container with strict CPU, memory, and network limits. Your code can\'t escape.',
                color: 'text-green-400',
              },
              {
                icon: Sparkles,
                title: 'AI-powered debugging',
                desc: 'Stuck? Our Gemini AI analyzes your code, pinpoints the bug, explains why it\'s wrong, and suggests a fix — streamed in real-time.',
                color: 'text-purple-400',
              },
              {
                icon: Cpu,
                title: 'Instant execution',
                desc: 'Code compiles and runs in under 2 seconds. No waiting in queues. Results appear immediately in the verdict panel.',
                color: 'text-blue-400',
              },
              {
                icon: Trophy,
                title: 'Compete & climb',
                desc: 'Solve problems to earn points. Track your progress on the leaderboard and see how you stack up against others.',
                color: 'text-yellow-400',
              },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="flex gap-4 p-5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-light)] transition-colors group">
                <Icon size={20} className={`${color} shrink-0 mt-0.5`} />
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{title}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            Ready to solve your first problem?
          </h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            No setup needed. Pick a problem, write code, and submit.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/problems" className="btn btn-primary px-8 py-2.5 font-semibold">
              Start Now
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] py-6">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <Code2 size={14} className="text-[var(--accent)]" />
            <span>CodeArena</span>
          </div>
          <span>Built with Node.js, React, Docker & Gemini AI</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
