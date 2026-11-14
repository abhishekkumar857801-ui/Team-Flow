import axios from 'axios';

// VITE_API_URL lets a deployed web app point at a separately hosted API.
// Left empty in dev so requests go through the Vite proxy.
export const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'X-Client': 'web' },
});

const TOKEN_KEY = 'teamflow.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.startsWith('/auth/login')) onUnauthorized();
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err?.response?.data?.error || (err?.request && !err.response ? 'Cannot reach the server' : err?.message) || 'Something went wrong';

export const fileUrl = (url) => (url?.startsWith('http') ? url : `${API_BASE}${url}`);
