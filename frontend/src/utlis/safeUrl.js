// Defense-in-depth guard for opening a user-supplied URL (resource links,
// avatar URLs, etc.). The backend now rejects non-http(s) URLs at write time
// (see backend/src/utils/url.utils.js), but this keeps the client safe against
// legacy data or any future write path that forgets to validate — a
// `javascript:` URL passed straight to window.open()/<a href> executes in the
// viewer's browser exactly like a normal stored-XSS payload would.
export const isSafeHttpUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim(), window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Open a user-supplied URL in a new tab only if it's a safe http(s) URL.
 * Returns true if the URL was opened, false if it was rejected.
 */
export const safeOpenUrl = (url) => {
  if (!isSafeHttpUrl(url)) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};
