export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/$/, '');
  const allowed = [
    'http://localhost:5173',
    process.env.CLIENT_URL,
  ]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, ''));

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
