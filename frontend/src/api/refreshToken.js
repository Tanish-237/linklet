import axios from 'axios';
import { API_BASE_URL } from '../config.js';

let inFlight = null;

/**
 * Renew the session using the httpOnly refresh cookie. Both tokens live only
 * in httpOnly cookies (never in JS-readable storage), so on success the new
 * access cookie is already set and callers just retry their request.
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
    .then(() => true)
    .catch((error) => {
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
