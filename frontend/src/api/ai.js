// Purpose: Frontend API client for the new AI endpoints (debug, hint, complexity).

import { API } from './client';

// Debug code — returns a streaming SSE response
export const debugCode = async (code, language, error, problemDescription, stdin) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_AWS_API_URL || 'http://localhost:5000'}/api/ai/debug`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, language, error, problemDescription, stdin }),
    }
  );
  return response;
};

// Get progressive hint
export const getHint = (problemDescription, code, language, attemptCount) =>
  API.post('/api/ai/hint', { problemDescription, code, language, attemptCount });

// Analyze time/space complexity
export const getComplexity = (code, language) =>
  API.post('/api/ai/complexity', { code, language });
