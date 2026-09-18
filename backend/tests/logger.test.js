import winston from 'winston';

// The module is re-imported (via a cache-busting query string, since Jest's
// ESM loader doesn't clear the dynamic-import cache the way it does for
// CommonJS require()) under different NODE_ENV values to verify the
// production/non-production branch actually takes effect at import time.
const importLoggerWithEnv = async (nodeEnv) => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const mod = await import(`../src/utils/logger.js?env=${nodeEnv}`);
  process.env.NODE_ENV = originalEnv;
  return mod.default;
};

describe('logger — environment-gated file transports', () => {
  test('in production, only logs to Console — Render\'s disk is ephemeral, so file transports would just leak unbounded log growth with zero durability benefit', async () => {
    console.log('[TEST] logger › production has no File transports');
    const logger = await importLoggerWithEnv('production');

    const hasFileTransport = logger.transports.some((t) => t instanceof winston.transports.File);
    expect(hasFileTransport).toBe(false);
    expect(logger.transports.some((t) => t instanceof winston.transports.Console)).toBe(true);
    expect(logger.level).toBe('info');
  });

  test('outside production, writes to logs/error.log and logs/combined.log for local debugging', async () => {
    console.log('[TEST] logger › development keeps File transports for local disk debugging');
    const logger = await importLoggerWithEnv('development');

    const fileTransports = logger.transports.filter((t) => t instanceof winston.transports.File);
    expect(fileTransports).toHaveLength(2);
    expect(logger.level).toBe('debug');
  });
});
