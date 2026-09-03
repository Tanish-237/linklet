import { jest } from '@jest/globals';

describe('Auth Cookie Configuration Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('configures cross-site friendly cookieOptions in production (SameSite=none, Secure=true)', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] auth.controller › verifies production cookie options');

    process.env.NODE_ENV = 'production';
    const { cookieOptions } = await import('../src/controllers/auth.controller.js');

    console.log('[TEST] Production cookieOptions:', cookieOptions);
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.secure).toBe(true);
    expect(cookieOptions.sameSite).toBe('none');
  });
});
