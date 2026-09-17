import axios from 'axios';
import { API_BASE_URL } from '../config.js';
import { refreshAccessToken } from './refreshToken.js';

// Create an Axios instance with base configuration
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // Crucial for sending/receiving cookies (access & refresh tokens)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization header fallback for Safari / browsers blocking 3rd-party cookies
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Delete Content-Type for FormData so Axios and browser set multipart/form-data with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle token refresh logic automatically on 401 errors
apiClient.interceptors.response.use(
  (response) => {
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
        const newToken = await refreshAccessToken();
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
