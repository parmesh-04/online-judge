import { API } from './client';

export const getAllProblems = (page = 1, limit = 10) => 
  API.get(`/api/problems?page=${page}&limit=${limit}`);

export const getProblem = (id) => API.get(`/api/problems/${id}`);
export const createProblem = (data) => API.post('/api/problems', data);
export const deleteProblem = (id) => API.delete(`/api/problems/${id}`);
