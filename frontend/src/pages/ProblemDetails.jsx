// ═══════════════════════════════════════════════════════════════════════
// frontend/src/pages/ProblemDetails.jsx — Core interactive coding page
// ═══════════════════════════════════════════════════════════════════════
//
// LAYOUT: Two-panel split view (50/50)
//   LEFT PANEL:  Problem statement with description and examples tabs,
//                plus AI hint display area
//   RIGHT PANEL: Monaco code editor with language selector, action buttons,
//                custom input area, and output/verdict display
//
// MONACO EDITOR CONFIG:
//   - minimap: disabled (saves screen space for competitive programming)
//   - fontSize: 14px with JetBrains Mono font (monospaced for code)
//   - scrollBeyondLastLine: false (prevents wasted whitespace)
//   - smoothScrolling: true (better UX)
//   - vs-dark theme (matches the app's dark design)
//
// RUN vs SUBMIT:
//   - "Run" (green button): Executes code against USER-PROVIDED custom input
//     via POST /compiler/run. No judging, no verdict — just shows raw output.
//     Used for testing/debugging before submitting.
//
//   - "Submit" (blue button): Executes code against ALL HIDDEN TEST CASES
//     via POST /compiler/submit. Returns a verdict (Accepted, Wrong Answer,
// frontend/src/pages/ProblemDetails.jsx
// Problem detail page with Monaco editor, code runner, and AI debug panel.
// AI streaming uses the Fetch API with ReadableStream to parse SSE chunks.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { getProblem } from '../api/problems';
import { runCode, submitCode } from '../api/compiler';
import { analyzeCode } from '../api/gemini';
import { debugCode as debugCodeAPI, getHint, getComplexity } from '../api/ai';
import AIDebugPanel from '../components/AIDebugPanel';
import {
  Play, Send, RotateCcw, Sparkles, Lightbulb, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Clock, Terminal
} from 'lucide-react';

const LANGUAGES = [
  { value: 'cpp', label: 'C++' },
  { value: 'py', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
];

const ProblemDetail = () => {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [showInput, setShowInput] = useState(false);

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
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

  const defaultTemplate = useMemo(() => {
    if (language === 'py') return 'print("Hello")\n';
    if (language === 'java')
      return 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}\n';
    if (language === 'javascript')
      return 'console.log("Hello");\n';
    return '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  \n  return 0;\n}\n';
  }, [language]);

  useEffect(() => {
    setCode(defaultTemplate);
  }, [defaultTemplate]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getProblem(id);
        setProblem(res.data);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load problem');
      }
    };
    load();
  }, [id]);

  const onRun = async () => {
    if (!input.trim()) {
      setError('Please provide input before running code');
      return;
    }
    setLoading(true);
    setOutput('');
    setError('');
    setVerdict(null);
    try {
      const res = await runCode(code, input, language);
      setOutput(res.data.output || '');
    } catch (e) {
      setError(e?.response?.data?.error || 'Run failed');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async () => {
    setLoading(true);
    setOutput('');
    setError('');
    setVerdict(null);
    setAttemptCount((c) => c + 1);
    try {
      const res = await submitCode(code, language, id);
      const v = res.data.verdict || res.data.output || '';
      setOutput(v);
      // Parse verdict type
      if (typeof v === 'string') {
        if (v.includes('Accepted')) setVerdict({ type: 'accepted', text: v });
        else if (v.includes('Wrong Answer')) setVerdict({ type: 'wrong', text: v, data: res.data.failedTestCase });
        else if (v.includes('Compile Error')) setVerdict({ type: 'compile', text: v });
        else if (v.includes('Time Limit')) setVerdict({ type: 'tle', text: v });
        else if (v.includes('Runtime Error')) setVerdict({ type: 'runtime', text: v });
        else setVerdict({ type: 'other', text: v });
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  const onDebug = async () => {
    setDebugPanelOpen(true);
    setDebugLoading(true);
    setDebugData(null);
    setStreamText('');
    setComplexity(null);

    try {
      // Start streaming debug
      const response = await debugCodeAPI(
        code, language, output || error, problem?.description || '', input
      );

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
            if (data.done && data.parsed) {
              setDebugData(data.parsed);
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }

      // Also get complexity
      try {
        const compRes = await getComplexity(code, language);
        setComplexity(compRes.data);
      } catch (e) {
        // Non-critical
      }
    } catch (e) {
      setStreamText('AI debug service is currently unavailable. Please try again later.');
    } finally {
      setDebugLoading(false);
    }
  };

  const onHint = async () => {
    setHintLoading(true);
    setHintData(null);
    try {
      const res = await getHint(problem?.description || '', code, language, attemptCount || 1);
      setHintData(res.data);
    } catch (e) {
      setError('Failed to get hint');
    } finally {
      setHintLoading(false);
    }
  };

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

  const verdictBorderColor = (type) => {
    switch (type) {
      case 'accepted': return 'border-green-500/50';
      case 'wrong': return 'border-red-500/50';
      case 'compile': return 'border-orange-500/50';
      case 'tle': return 'border-yellow-500/50';
      default: return 'border-red-500/50';
    }
  };

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
      <div className="w-1/2 border-r border-[var(--border)] overflow-y-auto p-6">
        {error && !problem && (
          <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-sm text-red-400">{error}</div>
        )}

        {problem && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{problem.title}</h1>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={`badge ${diffLabel(problem.difficulty).cls}`}>
                {diffLabel(problem.difficulty).text}
              </span>
              {(problem.tags || []).map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]">
                  {t}
                </span>
              ))}
            </div>

            {/* Tabs */}
            <div className="mt-6 flex gap-1 border-b border-[var(--border)]">
              {['description', 'examples'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {activeTab === 'description' && (
                <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {problem.description}
                </div>
              )}

              {activeTab === 'examples' && (
                <div className="space-y-4">
                  {problem.input && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Sample Input</div>
                      <pre className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)]">
                        {problem.input}
                      </pre>
                    </div>
                  )}
                  {problem.output && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Sample Output</div>
                      <pre className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)]">
                        {problem.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hint display */}
            {hintData && (
              <div className="mt-6 card p-4 border-blue-500/30 animate-fade-in">
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
            {/* Language selector */}
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
            language={language === 'cpp' ? 'cpp' : language === 'py' ? 'python' : language}
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
            }}
          />
        </div>

        {/* Custom Input (collapsible) */}
        <div className="border-t border-[var(--border)]">
          <button
            onClick={() => setShowInput(!showInput)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <span>Custom Input</span>
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

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <button
            disabled={loading}
            onClick={onRun}
            className="btn btn-success text-sm"
          >
            {loading ? <span className="spinner"></span> : <Play size={14} />}
            Run Code
          </button>
          <button
            disabled={loading}
            onClick={onSubmit}
            className="btn btn-primary text-sm px-6"
          >
            {loading ? <span className="spinner"></span> : <Send size={14} />}
            Submit
          </button>
        </div>

        {/* Output / Verdict Display */}
        {(output || error || verdict) && (
          <div className="border-t border-[var(--border)] max-h-48 overflow-y-auto">
            {error && (
              <div className="px-4 py-3 text-sm text-red-400 bg-red-900/10">{error}</div>
            )}

            {verdict && (
              <div className={`px-4 py-3 border-l-4 ${verdictBorderColor(verdict.type)} animate-slide-up`}>
                <div className="flex items-center gap-2">
                  <VerdictIcon type={verdict.type} />
                  <span className={`font-semibold text-sm ${
                    verdict.type === 'accepted' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {verdict.text}
                  </span>
                </div>
                {verdict.data && (
                  <div className="mt-2 space-y-1 text-xs font-mono">
                    <div className="text-[var(--text-muted)]">
                      Input: <span className="text-[var(--text-secondary)]">{verdict.data.input}</span>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      Expected: <span className="text-green-400">{verdict.data.expectedOutput}</span>
                    </div>
                    <div className="text-[var(--text-muted)]">
                      Got: <span className="text-red-400">{verdict.data.actualOutput}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!verdict && output && (
              <pre className="px-4 py-3 text-sm font-mono text-[var(--text-primary)] whitespace-pre-wrap">
                {output}
              </pre>
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
