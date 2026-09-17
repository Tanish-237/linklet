export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/$/, '');
  const allowed = [
    'http://localhost:5173',
    'https://linklet.org',
    'https://www.linklet.org',
    process.env.CLIENT_URL,
  ]
    .filter(Boolean)
    .flatMap((u) => {
      const clean = u.replace(/\/$/, '');
      if (clean.startsWith('https://www.')) {
        return [clean, clean.replace('https://www.', 'https://')];
      }
      if (clean.startsWith('https://')) {
        return [clean, clean.replace('https://', 'https://www.')];
      }
      return [clean];
    });

  if (allowed.includes(cleanOrigin)) return true;

  // Automatically allow THIS project's Vercel preview/production deployments.
  // Deliberately scoped to origins whose subdomain starts with "linklet" —
  // allowing every "*.vercel.app" origin (with credentials: true) would let
  // anyone with a free Vercel account stand up a page that makes authenticated
  // requests using a visiting user's cookies.
  if (/^https:\/\/linklet(-[a-z0-9-]+)*\.vercel\.app$/i.test(cleanOrigin)) return true;

  return false;
};

export const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};
