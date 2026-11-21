import { jest } from '@jest/globals';

// Tokens must only ever travel in httpOnly cookies — never in a JSON body that
// page JavaScript (or an XSS payload) could read.
const tokens = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' };

jest.unstable_mockModule('../src/services/auth.service.js', () => ({
  login: jest.fn().mockResolvedValue({ user: { _id: 'u1' }, ...tokens }),
  refresh: jest.fn().mockResolvedValue({ ...tokens }),
  googleAuth: jest.fn().mockResolvedValue({ user: { _id: 'u1' }, ...tokens, isNewUser: false }),
}));

const { loginUser, refreshAccessToken } = await import('../src/controllers/auth.controller.js');

const mockRes = () => {
  const res = {};
  res.cookie = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const expectCookiesOnly = (res) => {
  const opts = expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: expect.any(Number) });
  expect(res.cookie).toHaveBeenCalledWith('accesstoken', tokens.accessToken, opts);
  expect(res.cookie).toHaveBeenCalledWith('refreshtoken', tokens.refreshToken, opts);
  const body = JSON.stringify(res.json.mock.calls[0][0]);
  expect(body).not.toContain(tokens.accessToken);
  expect(body).not.toContain(tokens.refreshToken);
};

describe('auth tokens are cookie-only', () => {
  test('login sets both cookies and leaves tokens out of the response body', async () => {
    const res = mockRes();
    await loginUser({ body: { email: 'a@mnnit.ac.in', password: 'secret123' } }, res, jest.fn());
    expectCookiesOnly(res);
  });

  test('refresh rotates both cookies and leaves tokens out of the response body', async () => {
    const res = mockRes();
    await refreshAccessToken({ cookies: { refreshtoken: 'old' }, body: {} }, res, jest.fn());
    expectCookiesOnly(res);
  });
});

describe('cookie lifetimes', () => {
  test('match the token expiry settings, so a login survives closing the browser', async () => {
    const { expiryToMs } = await import('../src/controllers/auth.controller.js');
    expect(expiryToMs('15m')).toBe(15 * 60 * 1000);
    expect(expiryToMs('1d')).toBe(24 * 60 * 60 * 1000);
    expect(expiryToMs('10d')).toBe(10 * 24 * 60 * 60 * 1000);
    expect(expiryToMs('3600')).toBe(3600 * 1000);
    expect(expiryToMs('nonsense', 42)).toBe(42);
  });

  test('a refresh that only renews the access token leaves the refresh cookie alone', async () => {
    const { refresh } = await import('../src/services/auth.service.js');
    refresh.mockResolvedValueOnce({ accessToken: 'access.jwt', refreshToken: null });
    const res = mockRes();
    await refreshAccessToken({ cookies: { refreshtoken: 'old' }, body: {} }, res, jest.fn());
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith('accesstoken', 'access.jwt', expect.any(Object));
  });
});
