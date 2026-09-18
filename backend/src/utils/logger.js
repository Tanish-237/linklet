import winston from 'winston';

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const isProduction = process.env.NODE_ENV === 'production';

const transports = [
  // Always log to Console so cloud platforms like Render capture stdout/stderr.
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
];

// File transports are only useful with a real, persistent disk. Render's
// filesystem is ephemeral — it's wiped on every deploy/restart — so writing
// unbounded log files there buys no durability and just risks filling the
// container's disk over a long-running instance. Local dev has a real disk
// worth writing to for offline debugging.
if (!isProduction) {
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
