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
  // Automatically allow any Vercel deployment preview or production domain
  if (cleanOrigin.endsWith('.vercel.app')) return true;
  return false;
};

export const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};
