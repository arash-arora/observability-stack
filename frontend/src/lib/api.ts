import axios from 'axios';

const normalizeBase = (value: string) => value.replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return normalizeBase(process.env.NEXT_PUBLIC_API_BASE_URL);
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${normalizeBase(process.env.NEXT_PUBLIC_API_URL)}/api/v1`;
  }

  // Fallback to relative routing. Under Docker standalone mode, the frontend server
  // will proxy `/api/v1` requests to BACKEND_API_URL (default: http://backend:8000)
  // at runtime, preventing build-time IP/port configuration issues and CORS.
  return '/api/v1';
};

const apiBaseUrl = resolveApiBaseUrl();
if (process.env.NODE_ENV === 'development') {
  console.log("[API] Resolved Base URL:", apiBaseUrl);
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // 30-second timeout to prevent hanging requests
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optional: Redirect to login if on protected route
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
