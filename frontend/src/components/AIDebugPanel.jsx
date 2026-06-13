// Purpose: AI Debugger side panel component.
// Slides in from the right when triggered. Streams AI explanations
// with a typewriter effect and shows fixed code + complexity analysis.

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Copy, Check } from 'lucide-react';

const AIDebugPanel = ({ isOpen, onClose, debugData, isLoading, streamText, complexity }) => {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 animate-slide-right">
      <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <span className="font-semibold text-[var(--text-primary)]">AI Debugger</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && !streamText && (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4"></div>
              <div className="skeleton h-4 w-full"></div>
              <div className="skeleton h-4 w-5/6"></div>
              <div className="skeleton h-20 w-full mt-4"></div>
            </div>
          )}

          {/* Streaming text */}
          {streamText && (
            <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-mono">
              {streamText}
            </div>
          )}

          {/* Parsed debug data */}
          {debugData && (
            <>
              {debugData.explanation && (
                <div className="card p-3">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    Explanation
                  </h4>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {debugData.explanation}
                  </p>
                </div>
              )}

              {debugData.bugType && (
                <div className="flex gap-2">
                  <span className="badge bg-red-900/30 text-red-400">
                    {debugData.bugType}
                  </span>
                  <span className={`badge ${
                    debugData.severity === 'Critical' ? 'bg-red-900/30 text-red-400' :
                    debugData.severity === 'Major' ? 'bg-orange-900/30 text-orange-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {debugData.severity}
                  </span>
                </div>
              )}

              {debugData.fixedCode && (
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Fixed Code</span>
                    <button
                      onClick={() => handleCopyCode(debugData.fixedCode)}
                      className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy Fixed Code'}
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto bg-[var(--bg-primary)]">
                    {debugData.fixedCode}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* Complexity badges */}
          {complexity && (
            <div className="card p-3">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Complexity
              </h4>
              <div className="flex gap-2">
                <span className="badge bg-blue-900/30 text-blue-400">
                  Time: {complexity.timeComplexity}
                </span>
                <span className="badge bg-purple-900/30 text-purple-400">
                  Space: {complexity.spaceComplexity}
                </span>
              </div>
              {complexity.explanation && (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">{complexity.explanation}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDebugPanel;
