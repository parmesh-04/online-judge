// frontend/src/pages/ProblemDetails.jsx
// Problem detail page with Monaco editor, code runner, and AI debug panel.
// QoL: auto-filled sample input, test case numbers, keyboard shortcuts, better verdicts.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Editor from '@monaco-editor/react';
import { getProblem } from '../api/problems';
import { runCode, submitCode } from '../api/compiler';
import { analyzeCode } from '../api/gemini';
import { debugCode as debugCodeAPI, getHint, getComplexity } from '../api/ai';
import AIDebugPanel from '../components/AIDebugPanel';
import {
  Play, Send, RotateCcw, Sparkles, Lightbulb, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Clock, Terminal, Hash, Copy, Check
} from 'lucide-react';

const LANGUAGES = [
  { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
  { value: 'py', label: 'Python', monacoLang: 'python' },
  { value: 'java', label: 'Java', monacoLang: 'java' },
  { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
];

const ProblemDetail = () => {
  const { id } = useParams();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [showInput, setShowInput] = useState(true); // Open by default

  // AI state
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [complexity, setComplexity] = useState(null);
  const [hintData, setHintData] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  // Verdict state
  const [verdict, setVerdict] = useState(null);

  // Copy button state
  const [copied, setCopied] = useState(false);

  const defaultTemplate = useMemo(() => {
    if (language === 'py') return '# Read input and solve\nimport sys\ninput = sys.stdin.readline\n\ndef solve():\n    pass\n\nsolve()\n';
    if (language === 'java')
      return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Your code here\n    }\n}\n';
    if (language === 'javascript')
      return '// Read from stdin\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on("line", l => lines.push(l));\nrl.on("close", () => {\n    // Your code here\n});\n';
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    // Your code here\n    \n    return 0;\n}\n';
  }, [language]);

  useEffect(() => {
    setCode(defaultTemplate);
  }, [defaultTemplate]);

  // Load problem and pre-fill sample input
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getProblem(id);
        setProblem(res.data);
        // Auto-fill sample input so user can Run immediately
        if (res.data?.input) {
          setInput(res.data.input);
        }
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load problem');
      }
    };
    load();
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+Enter = Run
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!loading && !submitting) onRun();
      }
      // Ctrl+Shift+Enter = Submit
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (!loading && !submitting) onSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const onRun = async () => {
    if (!showInput) setShowInput(true);
    setLoading(true);
    setOutput('');
    setError('');
    setVerdict(null);
    try {
      const res = await runCode(code, input, language);
      setOutput(res.data.output || '(no output)');
    } catch (e) {
      if (e?.response?.status === 401) {
        setError('⚠️ You need to be logged in to run code. Please sign in first.');
      } else {
        setError(e?.response?.data?.error || 'Run failed — check your code for errors.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async () => {
    if (!auth.isLoggedIn) {
      setError('🔒 You need to be logged in to submit solutions. Create a free account to track your progress and compete on the leaderboard.');
      return;
    }
    setSubmitting(true);
    setOutput('');
    setError('');
    setVerdict(null);
    setAttemptCount((c) => c + 1);
    try {
      const res = await submitCode(code, language, id);
      const data = res.data;
      const v = data.verdict || data.output || '';
      setOutput(v);

      if (typeof v === 'string') {
        if (v.includes('Accepted')) {
          setVerdict({
            type: 'accepted',
            text: v,
            totalPassed: data.totalTestCases || null,
            totalTestCases: data.totalTestCases || null,
          });
        } else if (v.includes('Wrong Answer')) {
          setVerdict({
            type: 'wrong',
            text: v,
            testCaseNumber: data.testCaseNumber || null,
            totalTestCases: data.totalTestCases || null,
            totalPassed: data.testCaseNumber ? data.testCaseNumber - 1 : null,
            data: data.failedTestCase,
          });
        } else if (v.includes('Compile Error')) {
          setVerdict({ type: 'compile', text: v });
        } else if (v.includes('Time Limit')) {
          setVerdict({
            type: 'tle',
            text: v,
            testCaseNumber: data.testCaseNumber || null,
            totalTestCases: data.totalTestCases || null,
          });
        } else if (v.includes('Runtime Error')) {
          setVerdict({
            type: 'runtime',
            text: v,
            testCaseNumber: data.testCaseNumber || null,
            totalTestCases: data.totalTestCases || null,
          });
        } else {
          setVerdict({ type: 'other', text: v });
        }
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        setError('🔒 Session expired. Please log in again to submit.');
      } else {
        setError(e?.response?.data?.error || 'Submission failed — please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDebug = async () => {
    if (!auth.isLoggedIn) {
      setDebugPanelOpen(true);
      setDebugLoading(false);
      setStreamText('🔒 AI Debug requires a free account. Sign in to get AI-powered debugging with Gemini — it explains exactly what went wrong and how to fix it.');
      return;
    }
    setDebugPanelOpen(true);
    setDebugLoading(true);
    setDebugData(null);
    setStreamText('');
    setComplexity(null);

    try {
      const response = await debugCodeAPI(
        code, language, output || error, problem?.description || '', input
      );

      if (!response.ok) {
        setStreamText(response.status === 401
          ? '🔒 Session expired. Please log in again.'
          : '⚠️ AI debug service returned an error. Please try again.');
        setDebugLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              setStreamText(fullText);
            }
            if (data.done && data.parsed) setDebugData(data.parsed);
          } catch (_) {}
        }
      }

      try {
        const compRes = await getComplexity(code, language);
        setComplexity(compRes.data);
      } catch (_) {}
    } catch (_) {
      setStreamText('⚠️ AI debug service is temporarily unavailable.');
    } finally {
      setDebugLoading(false);
    }
  };

  const onHint = async () => {
    if (!auth.isLoggedIn) {
      setHintData({ hint: '🔒 AI hints require a free account. Sign in to get personalized hints powered by Gemini AI.', hintLevel: 'info' });
      return;
    }
    setHintLoading(true);
    setHintData(null);
    try {
      const res = await getHint(problem?.description || '', code, language, attemptCount || 1);
      setHintData(res.data);
    } catch (e) {
      if (e?.response?.status === 401) {
        setHintData({ hint: '🔒 Session expired. Log in again to use AI hints.', hintLevel: 'info' });
      } else {
        setHintData({ hint: '⚠️ AI hint service is temporarily unavailable.', hintLevel: 'info' });
      }
    } finally {
      setHintLoading(false);
    }
  };

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const diffLabel = (d) => {
    const n = Number(d);
    if (n <= 1) return { text: 'Easy', cls: 'badge-easy' };
    if (n <= 2) return { text: 'Medium', cls: 'badge-medium' };
    return { text: 'Hard', cls: 'badge-hard' };
  };

  const VerdictIcon = ({ type }) => {
    switch (type) {
      case 'accepted': return <CheckCircle2 size={20} className="text-green-400" />;
      case 'wrong': return <XCircle size={20} className="text-red-400" />;
      case 'compile': return <Terminal size={20} className="text-orange-400" />;
      case 'tle': return <Clock size={20} className="text-yellow-400" />;
      default: return <AlertTriangle size={20} className="text-red-400" />;
    }
  };

  const verdictClass = (type) => {
    switch (type) {
      case 'accepted': return 'verdict-accepted';
      case 'wrong': return 'verdict-wrong';
      case 'compile': return 'verdict-compile';
      case 'tle': return 'verdict-tle';
      default: return 'verdict-runtime';
    }
  };

  const monacoLang = LANGUAGES.find(l => l.value === language)?.monacoLang || language;

  if (!problem && !error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="space-y-4">
          <div className="skeleton h-8 w-1/3"></div>
          <div className="skeleton h-4 w-full"></div>
          <div className="skeleton h-4 w-5/6"></div>
          <div className="skeleton h-64 w-full mt-6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-60px)] flex overflow-hidden">
      {/* LEFT PANEL — Problem Statement */}
      <div className="w-1/2 border-r border-[var(--border)] overflow-y-auto">
        {error && !problem && (
          <div className="m-4 p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">{error}</div>
        )}

        {problem && (
          <div className="animate-fade-in">
            {/* Problem Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className={`badge ${diffLabel(problem.difficulty).cls}`}>
                  {diffLabel(problem.difficulty).text}
                </span>
                {(problem.tags || []).map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">
                    {t}
                  </span>
                ))}
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{problem.title}</h1>
            </div>

            {/* Tabs */}
            <div className="flex px-6 border-b border-[var(--border)] bg-[var(--bg-surface)]">
              {['description', 'examples'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`problem-tab capitalize ${activeTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-6 py-5">
              {activeTab === 'description' && (
                <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {problem.description}
                </div>
              )}

              {activeTab === 'examples' && (
                <div className="space-y-5">
                  {problem.input && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sample Input</span>
                        <button
                          onClick={() => copyToClipboard(problem.input)}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                        >
                          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)] overflow-x-auto">
                        {problem.input}
                      </pre>
                    </div>
                  )}
                  {problem.output && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Sample Output</div>
                      <pre className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)] overflow-x-auto">
                        {problem.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hint display */}
            {hintData && (
              <div className="mx-6 mb-5 card p-4 border-blue-500/30 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400 capitalize">{hintData.hintLevel} Hint</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{hintData.hint}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL — Editor + Controls */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <select
              className="bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-1.5 outline-none focus:border-[var(--accent)]"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <button
              onClick={() => setCode(defaultTemplate)}
              className="btn btn-outline text-xs px-2 py-1"
              title="Reset code"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onHint}
              disabled={hintLoading || !problem}
              className="btn btn-outline text-xs px-2 py-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <Lightbulb size={12} />
              {hintLoading ? 'Loading...' : 'Hint'}
            </button>
            <button
              onClick={onDebug}
              disabled={debugLoading || !code.trim()}
              className="btn btn-purple text-xs px-2 py-1"
            >
              <Sparkles size={12} />
              AI Debug
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={monacoLang}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              roundedSelection: true,
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              tabSize: 4,
              wordWrap: 'off',
              renderLineHighlight: 'line',
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>

        {/* Custom Input (open by default, pre-filled with sample) */}
        <div className="border-t border-[var(--border)]">
          <button
            onClick={() => setShowInput(!showInput)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <span className="flex items-center gap-2">
              Custom Input
              {input && <span className="text-xs text-[var(--text-muted)]">({input.split('\n').length} lines)</span>}
            </span>
            {showInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showInput && (
            <textarea
              className="w-full h-20 px-4 py-2 bg-[var(--bg-primary)] border-t border-[var(--border)] text-sm font-mono text-[var(--text-primary)] resize-none outline-none"
              placeholder="Enter your test input here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          )}
        </div>

        {/* Auth banner for guests */}
        {!auth.isLoggedIn && (
          <div className="px-4 py-2 border-t border-[var(--border)] bg-yellow-500/5 flex items-center justify-between gap-2">
            <span className="text-xs text-yellow-400">
              🔒 Sign in to submit solutions, track your rank, and use AI features
            </span>
            <div className="flex gap-2">
              <Link to="/login" className="text-xs btn btn-outline py-1 px-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10">
                Sign in
              </Link>
              <Link to="/register" className="text-xs btn btn-primary py-1 px-2">
                Register
              </Link>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <button
              disabled={loading || submitting}
              onClick={onRun}
              className="btn btn-success text-sm"
            >
              {loading ? <span className="spinner"></span> : <Play size={14} />}
              Run
            </button>
            <span className="kbd hidden sm:inline">Ctrl+↵</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="kbd hidden sm:inline">Ctrl+⇧+↵</span>
            <button
              disabled={loading || submitting}
              onClick={onSubmit}
              className={`btn text-sm px-6 ${
                auth.isLoggedIn ? 'btn-primary' : 'btn-outline border-[var(--accent)] text-[var(--accent)]'
              }`}
              title={!auth.isLoggedIn ? 'Sign in to submit' : ''}
            >
              {submitting ? <span className="spinner"></span> : <Send size={14} />}
              {auth.isLoggedIn ? 'Submit' : 'Submit (login required)'}
            </button>
          </div>
        </div>

        {/* Output / Verdict Display */}
        {(output || error || verdict) && (
          <div className="border-t border-[var(--border)] max-h-56 overflow-y-auto">
            {error && (
              <div className="px-4 py-3 text-sm bg-red-900/10 border-l-4 border-red-500/50">
                <span className="text-red-400">{error}</span>
                {(error.includes('log in') || error.includes('Sign in') || error.includes('Session expired') || error.includes('logged in')) && (
                  <div className="mt-2 flex gap-2">
                    <Link to="/login" className="text-xs btn btn-outline py-0.5 px-2 border-red-500/40 text-red-400">Sign in</Link>
                    <Link to="/register" className="text-xs btn btn-primary py-0.5 px-2">Create account</Link>
                  </div>
                )}
              </div>
            )}

            {verdict && (
              <div className={`px-4 py-4 ${verdictClass(verdict.type)}`}>
                <div className="flex items-center gap-2">
                  <VerdictIcon type={verdict.type} />
                  <span className={`font-bold text-sm ${
                    verdict.type === 'accepted' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {verdict.type === 'accepted' ? '✅ Accepted' :
                     verdict.type === 'wrong' ? '❌ Wrong Answer' :
                     verdict.text?.split('\n')[0] || verdict.text}
                  </span>
                </div>

                {/* Test case progress bar */}
                {verdict.totalTestCases && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-muted)]">
                        {verdict.type === 'accepted' ? (
                          <span className="text-green-400">{verdict.totalTestCases}/{verdict.totalTestCases} test cases passed</span>
                        ) : (
                          <>
                            <span className="text-red-400">
                              Failed on test case #{verdict.testCaseNumber}
                            </span>
                            <span className="text-[var(--text-muted)]"> of {verdict.totalTestCases}</span>
                          </>
                        )}
                      </span>
                      {verdict.totalPassed !== null && verdict.totalPassed !== undefined && (
                        <span className="text-[var(--text-muted)]">
                          {verdict.totalPassed}/{verdict.totalTestCases} passed
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          verdict.type === 'accepted' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${verdict.type === 'accepted'
                            ? 100
                            : ((verdict.totalPassed || 0) / verdict.totalTestCases) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Failed test case details */}
                {verdict.data && (
                  <div className="mt-3 space-y-2 text-xs font-mono">
                    <div className="flex gap-2">
                      <span className="text-[var(--text-muted)] shrink-0 w-16">Input:</span>
                      <pre className="text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded px-2 py-1 overflow-x-auto flex-1">{verdict.data.input}</pre>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--text-muted)] shrink-0 w-16">Expected:</span>
                      <pre className="text-green-400 bg-[var(--bg-primary)] rounded px-2 py-1 overflow-x-auto flex-1">{verdict.data.expectedOutput}</pre>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--text-muted)] shrink-0 w-16">Got:</span>
                      <pre className="text-red-400 bg-[var(--bg-primary)] rounded px-2 py-1 overflow-x-auto flex-1">{verdict.data.actualOutput}</pre>
                    </div>
                  </div>
                )}

                {/* Compile/Runtime error output */}
                {(verdict.type === 'compile' || verdict.type === 'runtime') && verdict.text && (
                  <pre className="mt-3 text-xs font-mono text-orange-300 bg-[var(--bg-primary)] rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {verdict.text.split('\n').slice(1).join('\n')}
                  </pre>
                )}
              </div>
            )}

            {!verdict && !error && output && (
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Output</div>
                <pre className="text-sm font-mono text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--bg-primary)] rounded p-3 border border-[var(--border)]">
                  {output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Debug Panel (slides in from right) */}
      <AIDebugPanel
        isOpen={debugPanelOpen}
        onClose={() => setDebugPanelOpen(false)}
        debugData={debugData}
        isLoading={debugLoading}
        streamText={streamText}
        complexity={complexity}
      />
    </div>
  );
};

export default ProblemDetail;
