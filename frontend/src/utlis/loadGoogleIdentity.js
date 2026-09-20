const GSI_SRC = "https://accounts.google.com/gsi/client";

let pending = null;

/**
 * Load Google Identity Services once, on demand.
 *
 * It used to be a global <script> in index.html, so every visitor — including
 * those who never reach a login screen (feed readers, people already signed
 * in) — paid for a third-party request. Now only screens that actually render a
 * Google button trigger it. Safe to call repeatedly: concurrent/later calls share
 * one script tag, and a failed load can be retried.
 */
export const loadGoogleIdentity = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending = null; // allow a retry (e.g. after the network comes back)
      script.remove();
      reject(new Error("Failed to load Google Sign-In"));
    };
    document.head.appendChild(script);
  });

  return pending;
};
