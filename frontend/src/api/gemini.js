import { API } from './client';

export const analyzeCode = (code, language, problemId) =>
  API.post('/api/gemini/analyze', { code, language, problemId });
