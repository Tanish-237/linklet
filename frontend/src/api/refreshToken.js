import axios from 'axios';
import { API_BASE_URL } from '../config.js';

export const readAccessToken = () => {
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
};

let inFlight = null;

/**
 * Renew the access token using the httpOnly refresh cookie.
 *
 * The backend rotates the refresh token on every call, so two concurrent
 * refreshes would hand out competing tokens and invalidate each other. Both
 * callers (the axios 401 interceptor and the socket handshake recovery) share
 * this single in-flight request instead.
 */
export const refreshAccessToken = () => {
  if (inFlight) return inFlight;

  inFlight = axios
    .post(`${API_BASE_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
    .then((response) => {
      const token = response.data?.accessToken;
      if (token) {
        try {
          localStorage.setItem('accessToken', token);
        } catch {
          // Private-mode/storage-blocked browsers still work via the cookie.
        }
      }
      return token || null;
    })
    .catch((error) => {
      try {
        localStorage.removeItem('accessToken');
      } catch {
        // Nothing to clear if storage is unavailable.
      }
      window.dispatchEvent(new Event('auth-expired'));
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Socket handshake failures that mean "your token is bad", as opposed to the
 * server being unreachable. Mirrors the rejection messages in backend/socket.js.
 */
export const isAuthHandshakeError = (error) => {
  const message = (error?.message || '').toLowerCase();
  return (
    message.includes('authentication') ||
    message.includes('token') ||
    message.includes('session expired')
  );
};
