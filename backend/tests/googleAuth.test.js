import { jest } from '@jest/globals';
import { AppError } from '../src/utils/error.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindUserByEmail = jest.fn();
const mockFindUserByUsername = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateRefreshToken = jest.fn();
const mockFindUserById = jest.fn();

jest.unstable_mockModule('../src/repositories/user.repository.js', () => ({
  findUserByEmail: mockFindUserByEmail,
  findUserByUsername: mockFindUserByUsername,
  createUser: mockCreateUser,
  updateRefreshToken: mockUpdateRefreshToken,
  findUserById: mockFindUserById,
}));

// Mock google-auth-library
const mockVerifyIdToken = jest.fn();
class MockOAuth2Client {
  constructor(clientId) {
    this.clientId = clientId;
  }
  verifyIdToken(opts) {
    return mockVerifyIdToken(opts);
  }
}

jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: MockOAuth2Client,
}));

const { authenticateWithGoogle } = await import('../src/services/auth.service.js');
const { googleAuth } = await import('../src/controllers/auth.controller.js');

describe('Google OAuth & Account Linking Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id_123';
  });

  test('throws 400 if no credential is provided', async () => {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('[TEST] authenticateWithGoogle › rejects empty credential');

    await expect(authenticateWithGoogle(null)).rejects.toThrow(
      new AppError('Google credential is required', 400)
    );
    console.log('[TEST] Confirmed 400 thrown for missing credential');
  });

  test('rejects non-institutional emails (not ending with @mnnit.ac.in)', async () => {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('[TEST] authenticateWithGoogle › rejects non-campus @gmail.com email');

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google_user_999',
        email: 'outsider@gmail.com',
        name: 'John Outsider',
        picture: 'https://example.com/pic.jpg',
      }),
    });

    await expect(authenticateWithGoogle('dummy_token')).rejects.toThrow(
      new AppError('Only @mnnit.ac.in institutional accounts are allowed', 400)
    );
    console.log('[TEST] Confirmed non-campus email was rejected with 400');
  });

  test('links Google ID to existing user account without data loss', async () => {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('[TEST] authenticateWithGoogle › links existing student account by email');

    const googleSub = 'google_sub_12345';
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: 'tanish@mnnit.ac.in',
        name: 'Tanish Sharma',
        picture: 'https://lh3.googleusercontent.com/avatar1.jpg',
      }),
    });

    const mockExistingUser = {
      _id: 'user_mongo_id_1',
      email: 'tanish@mnnit.ac.in',
      username: 'tanish_abc',
      fullName: 'Tanish Sharma',
      googleId: undefined,
      save: jest.fn().mockResolvedValue(true),
      generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
      generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
    };

    mockFindUserByEmail.mockResolvedValueOnce(mockExistingUser);
    mockFindUserById.mockResolvedValueOnce({
      _id: 'user_mongo_id_1',
      email: 'tanish@mnnit.ac.in',
      fullName: 'Tanish Sharma',
      googleId: googleSub,
    });

    const result = await authenticateWithGoogle('valid_google_token');

    expect(mockExistingUser.googleId).toBe(googleSub);
    expect(mockExistingUser.save).toHaveBeenCalled();
    expect(mockUpdateRefreshToken).toHaveBeenCalledWith(
      'user_mongo_id_1',
      'mock_refresh_token'
    );
    expect(result.accessToken).toBe('mock_access_token');
    expect(result.user.email).toBe('tanish@mnnit.ac.in');
    console.log('[TEST] Successfully linked Google ID to existing user and issued tokens');
  });

  test('registers brand new user with verified Google profile data', async () => {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('[TEST] authenticateWithGoogle › creates new user with Google profile info');

    const googleSub = 'google_sub_new_user';
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: '20235001@mnnit.ac.in',
        name: 'New Student',
        picture: 'https://lh3.googleusercontent.com/avatar_new.jpg',
      }),
    });

    mockFindUserByEmail.mockResolvedValueOnce(null);
    mockFindUserByUsername.mockResolvedValue(null);

    const mockCreatedUser = {
      _id: 'new_user_mongo_id',
      email: '20235001@mnnit.ac.in',
      fullName: 'New Student',
      googleId: googleSub,
      generateAccessToken: jest.fn().mockReturnValue('new_access_token'),
      generateRefreshToken: jest.fn().mockReturnValue('new_refresh_token'),
    };

    mockCreateUser.mockResolvedValueOnce(mockCreatedUser);
    mockFindUserById.mockResolvedValueOnce({
      _id: 'new_user_mongo_id',
      email: '20235001@mnnit.ac.in',
      fullName: 'New Student',
    });

    const result = await authenticateWithGoogle('new_valid_token');

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '20235001@mnnit.ac.in',
        fullName: 'New Student',
        googleId: googleSub,
      })
    );
    expect(result.accessToken).toBe('new_access_token');
    console.log('[TEST] Verified new user registered with Google details successfully');
  });

  test('googleAuth controller sets cookies and returns 200 on success', async () => {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('[TEST] googleAuth controller › sets cookies and returns response');

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'sub_ctrl_test',
        email: 'ctrl@mnnit.ac.in',
        name: 'Controller Test',
      }),
    });

    const mockUser = {
      _id: 'ctrl_user_id',
      email: 'ctrl@mnnit.ac.in',
      fullName: 'Controller Test',
      googleId: 'sub_ctrl_test',
      save: jest.fn().mockResolvedValue(true),
      generateAccessToken: jest.fn().mockReturnValue('ctrl_access_token'),
      generateRefreshToken: jest.fn().mockReturnValue('ctrl_refresh_token'),
    };

    mockFindUserByEmail.mockResolvedValueOnce(mockUser);
    mockFindUserById.mockResolvedValueOnce(mockUser);

    const req = {
      body: { credential: 'dummy_jwt_credential' },
    };
    const res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await googleAuth(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith('accesstoken', 'ctrl_access_token', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('refreshtoken', 'ctrl_refresh_token', expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Google authentication successful',
      })
    );
    console.log('[TEST] Confirmed cookies set and 200 response returned');
  });
});
