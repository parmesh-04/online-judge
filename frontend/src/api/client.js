// Purpose: Axios instances for backend and compiler API communication.

import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_AWS_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

const CompilerAPI = axios.create({
  baseURL: import.meta.env.VITE_COMPILER_URL || import.meta.env.VITE_COMPILER_API_URL || 'http://localhost:8000',
  withCredentials: true,
});

export { API, CompilerAPI };
