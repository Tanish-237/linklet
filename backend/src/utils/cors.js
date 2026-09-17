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
  // A bare "linklet" prefix is NOT an ownership check: anyone with a free Vercel
  // account can name their own project "linklet-phishing" and get a subdomain
  // that also starts with "linklet". So this must anchor on something an
  // attacker cannot also claim: either the exact production alias
  // (linklet.vercel.app, only ever assigned to this project) or a preview
  // deployment ending in our team slug (-hextan.vercel.app), which is unique
  // to this Vercel account and cannot be registered by anyone else.
  if (/^https:\/\/linklet\.vercel\.app$/i.test(cleanOrigin)) return true;
  if (/^https:\/\/linklet(-[a-z0-9]+)*-hextan\.vercel\.app$/i.test(cleanOrigin)) return true;

  return false;
};

export const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};
