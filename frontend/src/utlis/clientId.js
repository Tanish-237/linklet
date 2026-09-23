/**
 * Generate a per-send client id, used to reconcile an optimistic message bubble
 * with whichever arrives first — the HTTP response or the socket broadcast — and
 * to make a retried/double-submitted send idempotent server-side (see backend
 * chat.service.js sendMessage). Must match backend CLIENT_ID_PATTERN
 * (/^[A-Za-z0-9_-]{1,64}$/).
 */
export const generateClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
