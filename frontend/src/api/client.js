import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_AWS_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
});

const CompilerAPI = axios.create({
  baseURL: import.meta.env.VITE_COMPILER_API_URL || import.meta.env.VITE_BACKEND_URL2 || 'http://localhost:8000',
  withCredentials: true,
});

export { API, CompilerAPI };
