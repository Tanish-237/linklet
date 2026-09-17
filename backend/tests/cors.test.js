import { jest } from '@jest/globals';
import { isOriginAllowed, corsOriginHandler } from '../src/utils/cors.js';

describe('CORS Origin Validator Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('allows requests with no origin (e.g. curl / mobile)', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › permits empty origin');
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  test('allows localhost:5173', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › permits local dev origin');
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173/')).toBe(true);
  });

  test('allows any Vercel deployment domain', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › permits all vercel.app domains');
    expect(isOriginAllowed('https://linklet-74oo20r1u-hextan.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://linklet-74oo20r1u-hextan.vercel.app/')).toBe(true);
    expect(isOriginAllowed('https://linklet.vercel.app')).toBe(true);
  });

  test('allows custom CLIENT_URL even with trailing slash differences', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › matches CLIENT_URL normalized');
    process.env.CLIENT_URL = 'https://mycustomdomain.com/';
    expect(isOriginAllowed('https://mycustomdomain.com')).toBe(true);
    expect(isOriginAllowed('https://www.mycustomdomain.com')).toBe(true);
  });

  test('allows production custom domains linklet.org and www.linklet.org', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › permits production domains linklet.org and www.linklet.org');
    expect(isOriginAllowed('https://linklet.org')).toBe(true);
    expect(isOriginAllowed('https://linklet.org/')).toBe(true);
    expect(isOriginAllowed('https://www.linklet.org')).toBe(true);
    expect(isOriginAllowed('https://www.linklet.org/')).toBe(true);
  });

  test('rejects unauthorized origins', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › rejects malicious origin');
    expect(isOriginAllowed('https://malicious-site.com')).toBe(false);
  });

  test('rejects a Vercel deployment from an unrelated project (not just any *.vercel.app)', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] isOriginAllowed › does not blanket-trust every vercel.app origin');
    // Anyone can deploy to *.vercel.app on a free account — only THIS project's
    // deployments (subdomain starting with "linklet") should be trusted with
    // credentialed requests.
    expect(isOriginAllowed('https://evil-phishing-site.vercel.app')).toBe(false);
    expect(isOriginAllowed('https://attacker.vercel.app')).toBe(false);
  });

  test('corsOriginHandler calls callback with true for allowed origins and error for unauthorized', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] corsOriginHandler › executes callback correctly');

    const allowedCb = jest.fn();
    corsOriginHandler('https://linklet-74oo20r1u-hextan.vercel.app', allowedCb);
    expect(allowedCb).toHaveBeenCalledWith(null, true);

    const rejectedCb = jest.fn();
    corsOriginHandler('https://unauthorized.com', rejectedCb);
    expect(rejectedCb).toHaveBeenCalledWith(expect.any(Error));
  });
});
