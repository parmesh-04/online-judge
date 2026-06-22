// frontend/src/pages/ProblemDetails.jsx
// Problem detail page with Monaco editor, code runner, and AI debug panel.
// LeetCode-style: proper description rendering, auto-filled input, test case progress, keyboard shortcuts.

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
  CheckCircle2, XCircle, AlertTriangle, Clock, Terminal, Copy, Check, Tag, X
} from 'lucide-react';

const LANGUAGES = [
  { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
  { value: 'py', label: 'Python', monacoLang: 'python' },
  { value: 'java', label: 'Java', monacoLang: 'java' },
  { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
];

/**
 * Lightweight markdown-ish renderer for problem descriptions.
 * Handles: **bold**, `code`, - bullet lists, blank-line paragraphs.
 * No external dependencies needed.
 */
const renderDescription = (text) => {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Check if this is a list block (lines starting with -)
    const lines = trimmed.split('\n');
    const isList = lines.every(l => l.trim().startsWith('- ') || l.trim() === '');

    if (isList) {
      return (
        <ul key={pi} className="problem-list">
          {lines.filter(l => l.trim().startsWith('- ')).map((l, li) => (
            <li key={li}>{renderInline(l.trim().slice(2))}</li>
          ))}
        </ul>
      );
    }

    // Check if this is a heading-like line (starts with **)
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      const heading = trimmed.slice(2, -2);
      return <h3 key={pi} className="problem-section-heading">{heading}</h3>;
    }

    // Check if it starts with a bold label like "**Input Format:**"
    if (trimmed.startsWith('**')) {
      // Could be "**Label:**\n- item1\n- item2"
      const firstNewline = trimmed.indexOf('\n');
      if (firstNewline > -1) {
        const heading = trimmed.slice(0, firstNewline);
        const rest = trimmed.slice(firstNewline + 1);
        const restLines = rest.split('\n');
        const restIsList = restLines.every(l => l.trim().startsWith('- ') || l.trim() === '');

        return (
          <div key={pi} className="mb-4">
            <p className="problem-text">{renderInline(heading)}</p>
            {restIsList ? (
              <ul className="problem-list">
                {restLines.filter(l => l.trim().startsWith('- ')).map((l, li) => (
                  <li key={li}>{renderInline(l.trim().slice(2))}</li>
                ))}
              </ul>
            ) : (
              <p className="problem-text">{renderInline(rest)}</p>
            )}
          </div>
        );
      }
    }

    // Regular paragraph — may contain multiple lines
    return (
      <p key={pi} className="problem-text">
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>
    );
  });
};

/** Renders inline formatting: **bold** and `code` */
const renderInline = (text) => {
  if (!text) return null;
  // Split by **bold** and `code` patterns
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the first match of either **bold** or `code`
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);

    let firstMatch = null;
    let type = null;

    if (boldMatch && codeMatch) {
      if (boldMatch.index <= codeMatch.index) {
        firstMatch = boldMatch;
        type = 'bold';
      } else {
        firstMatch = codeMatch;
        type = 'code';
      }
    } else if (boldMatch) {
      firstMatch = boldMatch;
      type = 'bold';
    } else if (codeMatch) {
      firstMatch = codeMatch;
      type = 'code';
    }

    if (!firstMatch) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Add text before match
    if (firstMatch.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, firstMatch.index)}</span>);
    }

    // Add formatted element
    if (type === 'bold') {
      parts.push(<strong key={key++} className="text-[var(--text-primary)] font-semibold">{firstMatch[1]}</strong>);
    } else {
      parts.push(<code key={key++} className="problem-inline-code">{firstMatch[1]}</code>);
    }

    remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
  }

  return parts;
};

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
  const [showInput, setShowInput] = useState(true);

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
  const [copiedField, setCopiedField] = useState(null);

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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getProblem(id);
        setProblem(res.data);
        if (res.data?.input) setInput(res.data.input);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load problem');
      }
    };
    load();
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!loading && !submitting) onRun();
      }
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
      setError('🔒 You need to be logged in to submit. Create a free account to track progress and compete.');
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
          setVerdict({ type: 'accepted', text: v, totalPassed: data.totalTestCases, totalTestCases: data.totalTestCases });
        } else if (v.includes('Wrong Answer')) {
          setVerdict({ type: 'wrong', text: v, testCaseNumber: data.testCaseNumber, totalTestCases: data.totalTestCases, totalPassed: data.testCaseNumber ? data.testCaseNumber - 1 : null, data: data.failedTestCase });
        } else if (v.includes('Compile Error')) {
          setVerdict({ type: 'compile', text: v });
        } else if (v.includes('Time Limit')) {
          setVerdict({ type: 'tle', text: v, testCaseNumber: data.testCaseNumber, totalTestCases: data.totalTestCases });
        } else if (v.includes('Runtime Error')) {
          setVerdict({ type: 'runtime', text: v, testCaseNumber: data.testCaseNumber, totalTestCases: data.totalTestCases });
        } else {
          setVerdict({ type: 'other', text: v });
        }
      }
    } catch (e) {
      if (e?.response?.status === 401) setError('🔒 Session expired. Please log in again.');
      else setError(e?.response?.data?.error || 'Submission failed — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDebug = async () => {
    if (!auth.isLoggedIn) {
      setDebugPanelOpen(true);
      setDebugLoading(false);
      setStreamText('🔒 AI Debug requires a free account. Sign in to get AI-powered debugging.');
      return;
    }
    setDebugPanelOpen(true);
    setDebugLoading(true);
    setDebugData(null);
    setStreamText('');
    setComplexity(null);
    try {
      const response = await debugCodeAPI(code, language, output || error, problem?.description || '', input);
      if (!response.ok) {
        setStreamText(response.status === 401 ? '🔒 Session expired. Please log in again.' : '⚠️ AI debug service returned an error.');
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
            if (data.text) { fullText += data.text; setStreamText(fullText); }
            if (data.done && data.parsed) setDebugData(data.parsed);
          } catch (_) {}
        }
      }
      try { const compRes = await getComplexity(code, language); setComplexity(compRes.data); } catch (_) {}
    } catch (_) {
      setStreamText('⚠️ AI debug service is temporarily unavailable.');
    } finally {
      setDebugLoading(false);
    }
  };

  const onHint = async () => {
    if (!auth.isLoggedIn) {
      setHintData({ hint: '🔒 AI hints require a free account. Sign in to get personalized hints.', hintLevel: 'info' });
      return;
    }
    setHintLoading(true);
    setHintData(null);
    try {
      const res = await getHint(problem?.description || '', code, language, attemptCount || 1);
      setHintData(res.data);
    } catch (e) {
      setHintData({ hint: e?.response?.status === 401 ? '🔒 Session expired.' : '⚠️ AI hint service unavailable.', hintLevel: 'info' });
    } finally {
      setHintLoading(false);
    }
  };

  const copyText = useCallback((text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const diffLabel = (d) => {
    const n = Number(d);
    if (n <= 1) return { text: 'Easy', cls: 'badge-easy' };
    if (n <= 2) return { text: 'Medium', cls: 'badge-medium' };
    return { text: 'Hard', cls: 'badge-hard' };
  };

  const monacoLang = LANGUAGES.find(l => l.value === language)?.monacoLang || language;

  // Loading skeleton
  if (!problem && !error) {
    return (
      <div className="h-[calc(100vh-60px)] flex">
        <div className="w-1/2 p-6 space-y-4">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-32 w-full mt-4" />
        </div>
        <div className="w-1/2 bg-[var(--bg-surface)]">
          <div className="skeleton h-full w-full" style={{ borderRadius: 0 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-60px)] flex overflow-hidden">
      {/* ═══ LEFT PANEL — Problem Statement ═══ */}
      <div className="w-1/2 border-r border-[var(--border)] flex flex-col overflow-hidden">
        {error && !problem && (
          <div className="m-4 p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">{error}</div>
        )}

        {problem && (
          <div className="flex-1 overflow-y-auto">
            {/* Problem Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">{problem.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${diffLabel(problem.difficulty).cls}`}>
                  {diffLabel(problem.difficulty).text}
                </span>
                {(problem.tags || []).map((t) => (
                  <span key={t} className="tag-pill">
                    <Tag size={10} />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Description — rendered with formatting */}
            <div className="px-6 py-5 problem-description">
              {renderDescription(problem.description)}
            </div>

            {/* Example I/O — LeetCode style boxes */}
            {(problem.input || problem.output) && (
              <div className="px-6 pb-5">
                <h3 className="problem-section-heading">Example</h3>
                <div className="example-box">
                  {problem.input && (
                    <div className="example-row">
                      <div className="example-label">
                        <span>Input</span>
                        <button
                          onClick={() => { copyText(problem.input, 'input'); setInput(problem.input); }}
                          className="example-copy-btn"
                        >
                          {copiedField === 'input' ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                          {copiedField === 'input' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="example-content">{problem.input}</pre>
                    </div>
                  )}
                  {problem.output && (
                    <div className="example-row">
                      <div className="example-label">
                        <span>Output</span>
                        <button
                          onClick={() => copyText(problem.output, 'output')}
                          className="example-copy-btn"
                        >
                          {copiedField === 'output' ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                          {copiedField === 'output' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="example-content">{problem.output}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Floating Hint display */}
            {hintData && (
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-lg border border-blue-500/40 bg-[#1e293b]/95 backdrop-blur-sm shadow-2xl animate-fade-in z-10" style={{ maxWidth: 'calc(50% - 3rem)' }}>
                <div className="flex items-center justify-between mb-2 border-b border-blue-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={16} className="text-blue-400" />
                    <span className="text-sm font-semibold text-blue-400 capitalize">{hintData.hintLevel} Hint</span>
                  </div>
                  <button onClick={() => setHintData(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto pr-2">{hintData.hint}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL — Editor + Controls ═══ */}
      <div className="w-1/2 flex flex-col overflow-hidden bg-[#1e1e1e]">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <select
              className="bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded px-2 py-1 outline-none focus:border-[var(--accent)]"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <button onClick={() => setCode(defaultTemplate)} className="icon-btn" title="Reset code">
              <RotateCcw size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onHint}
              disabled={hintLoading || !problem}
              className="icon-btn text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              title="Get AI hint"
            >
              <Lightbulb size={13} />
              <span className="text-xs hidden sm:inline">{hintLoading ? '...' : 'Hint'}</span>
            </button>
            <button
              onClick={onDebug}
              disabled={debugLoading || !code.trim()}
              className="icon-btn bg-purple-600/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
              title="AI Debug"
            >
              <Sparkles size={13} />
              <span className="text-xs hidden sm:inline">Debug</span>
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
              padding: { top: 8, bottom: 8 },
              roundedSelection: true,
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              tabSize: 4,
              wordWrap: 'off',
              renderLineHighlight: 'line',
              bracketPairColorization: { enabled: true },
              lineDecorationsWidth: 8,
            }}
          />
        </div>

        {/* Custom Input */}
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <button
            onClick={() => setShowInput(!showInput)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Terminal size={12} />
              Testcase
              {input && <span className="text-[var(--text-muted)]">· {input.split('\n').length} lines</span>}
            </span>
            {showInput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showInput && (
            <textarea
              className="w-full h-16 px-3 py-2 bg-[var(--bg-primary)] border-t border-[var(--border)] text-xs font-mono text-[var(--text-primary)] resize-none outline-none"
              placeholder="Input will be pre-filled from the sample..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          )}
        </div>

        {/* Auth banner for guests */}
        {!auth.isLoggedIn && (
          <div className="px-3 py-1.5 border-t border-[var(--border)] bg-yellow-500/5 flex items-center justify-between gap-2">
            <span className="text-xs text-yellow-400">
              🔒 Sign in to submit and use AI features
            </span>
            <div className="flex gap-1.5">
              <Link to="/login" className="text-xs btn btn-outline py-0.5 px-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10">Sign in</Link>
              <Link to="/register" className="text-xs btn btn-primary py-0.5 px-2">Register</Link>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <button disabled={loading || submitting} onClick={onRun} className="btn btn-success text-xs py-1.5">
              {loading ? <span className="spinner" /> : <Play size={13} />}
              Run
            </button>
            <span className="kbd hidden lg:inline">Ctrl+↵</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="kbd hidden lg:inline">Ctrl+⇧+↵</span>
            <button
              disabled={loading || submitting}
              onClick={onSubmit}
              className={`btn text-xs py-1.5 px-5 ${auth.isLoggedIn ? 'btn-primary' : 'btn-outline border-[var(--accent)] text-[var(--accent)]'}`}
              title={!auth.isLoggedIn ? 'Sign in to submit' : ''}
            >
              {submitting ? <span className="spinner" /> : <Send size={13} />}
              {auth.isLoggedIn ? 'Submit' : 'Submit (login)'}
            </button>
          </div>
        </div>

        {/* Output / Verdict */}
        {(output || error || verdict) && (
          <div className="border-t border-[var(--border)] max-h-52 overflow-y-auto bg-[var(--bg-primary)]">
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
              <div className={`px-4 py-4 ${verdict.type === 'accepted' ? 'verdict-accepted' : verdict.type === 'wrong' ? 'verdict-wrong' : verdict.type === 'compile' ? 'verdict-compile' : verdict.type === 'tle' ? 'verdict-tle' : 'verdict-runtime'}`}>
                <div className="flex items-center gap-2">
                  {verdict.type === 'accepted' ? <CheckCircle2 size={18} className="text-green-400" /> :
                   verdict.type === 'wrong' ? <XCircle size={18} className="text-red-400" /> :
                   verdict.type === 'tle' ? <Clock size={18} className="text-yellow-400" /> :
                   <AlertTriangle size={18} className="text-red-400" />}
                  <span className={`font-bold text-sm ${verdict.type === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
                    {verdict.type === 'accepted' ? 'Accepted' :
                     verdict.type === 'wrong' ? 'Wrong Answer' :
                     verdict.text?.split('\n')[0]?.replace('❌ ', '') || 'Error'}
                  </span>
                </div>

                {/* Test case progress */}
                {verdict.totalTestCases && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={verdict.type === 'accepted' ? 'text-green-400' : 'text-red-400'}>
                        {verdict.type === 'accepted'
                          ? `${verdict.totalTestCases}/${verdict.totalTestCases} test cases passed`
                          : `Failed on test case #${verdict.testCaseNumber} of ${verdict.totalTestCases}`}
                      </span>
                      {verdict.totalPassed != null && verdict.type !== 'accepted' && (
                        <span className="text-[var(--text-muted)]">{verdict.totalPassed}/{verdict.totalTestCases} passed</span>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${verdict.type === 'accepted' ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${verdict.type === 'accepted' ? 100 : ((verdict.totalPassed || 0) / verdict.totalTestCases) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Failed test case diff */}
                {verdict.data && (
                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="grid grid-cols-[56px_1fr] gap-1">
                      <span className="text-[var(--text-muted)]">Input</span>
                      <pre className="text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded px-2 py-1 overflow-x-auto">{verdict.data.input}</pre>
                    </div>
                    <div className="grid grid-cols-[56px_1fr] gap-1">
                      <span className="text-[var(--text-muted)]">Expected</span>
                      <pre className="text-green-400 bg-[var(--bg-surface)] rounded px-2 py-1 overflow-x-auto">{verdict.data.expectedOutput}</pre>
                    </div>
                    <div className="grid grid-cols-[56px_1fr] gap-1">
                      <span className="text-[var(--text-muted)]">Got</span>
                      <pre className="text-red-400 bg-[var(--bg-surface)] rounded px-2 py-1 overflow-x-auto">{verdict.data.actualOutput}</pre>
                    </div>
                  </div>
                )}

                {(verdict.type === 'compile' || verdict.type === 'runtime') && verdict.text && (
                  <pre className="mt-3 text-xs font-mono text-orange-300 bg-[var(--bg-surface)] rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {verdict.text.split('\n').slice(1).join('\n')}
                  </pre>
                )}
              </div>
            )}

            {!verdict && !error && output && (
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Output</div>
                <pre className="text-sm font-mono text-[var(--text-primary)] whitespace-pre-wrap">{output}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Debug Panel */}
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
