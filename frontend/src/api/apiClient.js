import axios from 'axios';
import { API_BASE_URL } from '../config.js';

// Create an Axios instance with base configuration
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // Crucial for sending/receiving cookies (access & refresh tokens)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle token refresh logic automatically on 401 errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token
        await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true } // Must send refresh cookie
        );

        // If successful, the new token is automatically set in cookies by the backend.
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, it means the refresh token is expired or invalid.
        // The user must log in again.
        // We could trigger a Zustand state change here to log the user out globally.
        window.dispatchEvent(new Event('auth-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
