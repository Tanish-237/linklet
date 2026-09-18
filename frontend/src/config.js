export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

// Canonical production origin — used for absolute og:image/og:url values.
// Social crawlers (WhatsApp, LinkedIn, iMessage) require an absolute URL for
// og:image; a relative path resolves against their own domain, not ours.
export const SITE_URL = "https://linklet.org";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/linklet-logo.png`;
