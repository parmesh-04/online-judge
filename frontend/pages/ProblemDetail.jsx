import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProblem } from '../api/problems';
import { runCode, submitCode } from '../api/compiler';
import { analyzeCode } from '../api/gemini';

const ProblemDetail = () => {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const defaultTemplate = useMemo(() => {
    if (language === 'py') return 'print("Hello")\n';
    if (language === 'java')
      return 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}\n';
    if (language === 'c')
      return '#include <stdio.h>\nint main(){\n  printf("Hello");\n  return 0;\n}\n';
    return '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n';
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
    // Check if input is empty (after trimming whitespace)
    if (!input.trim()) {
      setError('Please provide input before running code');
      return;
    }

    setLoading(true);
    setOutput('');
    setError('');
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
    try {
      const res = await submitCode(code, language, id);
      setOutput(res.data.verdict || res.data.output || '');
    } catch (e) {
      setError(e?.response?.data?.error || 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  const onAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    setAiAnalysis(null);
    try {
      const res = await analyzeCode(code, language, id);
      setAiAnalysis(res.data.analysis);
    } catch (e) {
      setError(e?.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {error ? <div className="text-red-300 text-sm">{error}</div> : null}

      {problem ? (
        <>
          <h2 className="text-2xl font-semibold text-slate-100">
            {problem.title}
          </h2>
          <div className="mt-3 text-slate-300 whitespace-pre-wrap">{problem.description}</div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-200 font-medium">Editor</div>
                <select
                  className="bg-slate-900 border border-slate-800 text-slate-100 text-sm rounded px-2 py-1"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="py">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>

              <textarea
                className="mt-3 w-full min-h-[320px] resize-y rounded-md bg-slate-950 border border-slate-800 text-slate-100 p-3 font-mono text-sm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />

              <div className="mt-3 flex gap-2">
                <button
                  disabled={loading}
                  onClick={onRun}
                  className="px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50"
                >
                  Run
                </button>
                <button
                  disabled={loading}
                  onClick={onSubmit}
                  className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                >
                  Submit
                </button>
                <button
                  disabled={analyzing || !code.trim()}
                  onClick={onAnalyze}
                  className="px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm disabled:opacity-50"
                >
                  {analyzing ? 'Analyzing...' : 'AI Analysis'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-sm text-slate-200 font-medium">Input</div>
              <textarea
                className="mt-3 w-full min-h-[120px] resize-y rounded-md bg-slate-950 border border-slate-800 text-slate-100 p-3 font-mono text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              <div className="mt-6 text-sm text-slate-200 font-medium">Output</div>
              <pre className="mt-3 min-h-[120px] whitespace-pre-wrap rounded-md bg-slate-950 border border-slate-800 text-slate-100 p-3 text-sm">
                {output}
              </pre>
            </div>

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-4">
                <div className="text-sm text-slate-200 font-medium mb-3">AI Analysis</div>
                <div className={`p-3 rounded-md ${
                  aiAnalysis.isCorrect 
                    ? 'bg-green-900/30 border border-green-800' 
                    : 'bg-red-900/30 border border-red-800'
                }`}>
                  <div className={`font-medium ${
                    aiAnalysis.isCorrect ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {aiAnalysis.isCorrect ? '✅ Well done!' : '❌ Issues Found'}
                  </div>
                  <div className="mt-2 text-slate-200 text-sm">
                    {aiAnalysis.feedback}
                  </div>
                  {aiAnalysis.hints && aiAnalysis.hints.length > 0 && (
                    <div className="mt-3">
                      <div className="text-slate-300 text-sm font-medium">Hints:</div>
                      <ul className="mt-1 list-disc list-inside text-slate-200 text-sm">
                        {aiAnalysis.hints.map((hint, index) => (
                          <li key={index}>{hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-slate-200">Loading...</div>
      )}
    </div>
  );
};

export default ProblemDetail;
