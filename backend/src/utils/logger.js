import winston from 'winston';

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const isProduction = process.env.NODE_ENV === 'production';

const transports = [
  // Always log to Console so the hosting platform (Vercel) captures stdout/stderr.
  // Colours only in a local terminal: in Vercel's log viewer they show up as
  // raw escape codes.
  new winston.transports.Console({
    format: isProduction || process.env.VERCEL
      ? logFormat
      : winston.format.combine(winston.format.colorize(), logFormat),
  }),
];

// File transports are only useful with a real, persistent disk. In production
// (and on any Vercel deployment, whose filesystem is read-only) logs go to
// stdout only. Local dev has a real disk worth writing to for offline debugging.
if (!isProduction && !process.env.VERCEL) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'linklet-backend' },
  transports,
});

export default logger;
