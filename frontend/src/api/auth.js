import { API } from './client';

export const register = (email, password, firstname, lastname) =>
  API.post('/api/auth/register', { email, password, firstname, lastname });

export const login = (email, password) => API.post('/api/auth/login', { email, password });

export const logout = () => API.post('/api/auth/logout');

export const getUserStats = () => API.get('/api/user/stats');
