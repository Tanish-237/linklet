import { jest } from '@jest/globals';

// Tokens must only ever travel in httpOnly cookies — never in a JSON body that
// page JavaScript (or an XSS payload) could read.
const tokens = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' };

jest.unstable_mockModule('../src/services/auth.service.js', () => ({
  login: jest.fn().mockResolvedValue({ user: { _id: 'u1' }, ...tokens }),
  refresh: jest.fn().mockResolvedValue({ ...tokens }),
  googleAuth: jest.fn().mockResolvedValue({ user: { _id: 'u1' }, ...tokens, isNewUser: false }),
}));

const { loginUser, refreshAccessToken, cookieOptions } = await import('../src/controllers/auth.controller.js');

const mockRes = () => {
  const res = {};
  res.cookie = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const expectCookiesOnly = (res) => {
  expect(res.cookie).toHaveBeenCalledWith('accesstoken', tokens.accessToken, cookieOptions);
  expect(res.cookie).toHaveBeenCalledWith('refreshtoken', tokens.refreshToken, cookieOptions);
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
