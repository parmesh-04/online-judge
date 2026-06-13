import { CompilerAPI } from './client';

export const runCode = (code, input, language) => CompilerAPI.post('/compiler/run', { code, input, language });

export const submitCode = (code, language, problemId) =>
  CompilerAPI.post('/compiler/submit', { code, language, problemId });
