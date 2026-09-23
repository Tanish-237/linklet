import axios from 'axios';
import { API_BASE_URL } from '../config.js';
import { refreshAccessToken } from './refreshToken.js';
import { queryClient } from '../utlis/queryClient.js';

// Create an Axios instance with base configuration
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // Crucial for sending/receiving cookies (access & refresh tokens)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth rides on the httpOnly cookies only. Older builds also kept the access
// token in localStorage; clear any leftover copy so it can't be read by scripts.
try {
  localStorage.removeItem('accessToken');
} catch {
  // Storage unavailable — nothing to clear
}

apiClient.interceptors.request.use(
  (config) => {
    // Delete Content-Type for FormData so Axios and browser set multipart/form-data with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Pages keep their data in the React Query cache (see hooks/useCachedState).
// After a successful write, mark every cached page that shows that kind of
// data as stale, so the next visit quietly refreshes it — e.g. saving a post
// from the feed shows up on /saved without each call site knowing about it.
// `refetchType: 'none'` leaves the page on screen alone: it already applied
// the change optimistically, and refetching a long list on every upvote would
// be exactly the request storm this cache exists to avoid.
const STALE_AFTER_WRITE = [
  [/^\/profile\/(bookmarks|collections)/, [['saved'], ['bookmarks']]],
  [/^\/profile\/(edit|follow)/, [['profile']]],
  [/^\/resources/, [['resources'], ['saved']]],
  [/^\/questions/, [['forum']]],
  [/^\/posts/, [['userPosts'], ['saved']]],
  [/^\/(dashboard|timetable)/, [['dashboard']]],
];

const markStaleAfterWrite = (config) => {
  if (!config || ['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) return;
  const url = (config.url || '').split('?')[0];
  for (const [pattern, keys] of STALE_AFTER_WRITE) {
    if (!pattern.test(url)) continue;
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'none' }));
  }
};

// Interceptor to handle token refresh logic automatically on 401 errors
apiClient.interceptors.response.use(
  (response) => {
    markStaleAfterWrite(response.config);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh attempt on auth endpoints to prevent redundant requests, masking errors, and loops
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/check') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/send-otp') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/google') ||
      originalRequest.url?.includes('/auth/forgot-password-otp') ||
      originalRequest.url?.includes('/auth/reset-password');

    // If the error is 401 (Unauthorized) and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        // Shared with the socket handshake recovery so two concurrent 401s
        // (e.g. an API call and a socket reconnect) don't each rotate the
        // refresh token and invalidate one another.
        await refreshAccessToken();
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
