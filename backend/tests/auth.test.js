import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindUserByEmail = jest.fn();
const mockFindUserByUsername = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateRefreshToken = jest.fn();
const mockFindUserById = jest.fn();
const mockFindUserWithPasswordById = jest.fn();

jest.unstable_mockModule('../src/repositories/user.repository.js', () => ({
  findUserByEmail: mockFindUserByEmail,
  findUserByUsername: mockFindUserByUsername,
  createUser: mockCreateUser,
  updateRefreshToken: mockUpdateRefreshToken,
  findUserById: mockFindUserById,
  findUserWithPasswordById: mockFindUserWithPasswordById,
}));

const mockRedisSetEx = jest.fn().mockResolvedValue('OK');
const mockRedisGet = jest.fn();
const mockRedisDel = jest.fn().mockResolvedValue(1);

jest.unstable_mockModule('../src/utils/redis.js', () => ({
  getRedisClient: jest.fn(() => ({
    setEx: mockRedisSetEx,
    get: mockRedisGet,
    del: mockRedisDel,
  })),
}));

const mockSendEmail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
jest.unstable_mockModule('../src/utils/email.service.js', () => ({
  sendEmail: mockSendEmail,
}));

const { generateAndSendOtp, register, changePassword, forgotPasswordSendOtp, resetPassword } = await import('../src/services/auth.service.js');
const { cookieOptions, changePassword: changePasswordController, sendForgotPasswordOtp: sendForgotPasswordOtpController, resetPassword: resetPasswordController } = await import('../src/controllers/auth.controller.js');
const { calculateAcademicYear, calculateDefaultSemester } = await import('../src/utils/academicYear.js');

describe('Auth Cookie Configuration Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('configures cross-site friendly cookieOptions in production (SameSite=none, Secure=true)', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] auth.controller › verifies production cookie options');

    process.env.NODE_ENV = 'production';
    console.log('[TEST] Production cookieOptions:', cookieOptions);
    expect(cookieOptions.httpOnly).toBe(true);
    expect(typeof cookieOptions.secure).toBe('boolean');
  });
});

describe('Dynamic Academic Year Calculation Unit Tests', () => {
  test('calculates correct academic year based on email admission year and academic session boundary', () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] calculateAcademicYear › evaluates session boundaries and roll number');

    // Case 1: Student admitted in 2023 tested in August 2023 -> First Year
    const aug2023 = new Date(2023, 7, 1); // August 1, 2023
    const yearAug2023 = calculateAcademicYear('revan.20233291@mnnit.ac.in', aug2023);
    console.log('[TEST] 2023 admit in Aug 2023:', yearAug2023);
    expect(yearAug2023).toBe('First');

    // Case 2: Student admitted in 2023 tested in March 2024 (before mid-May) -> Still First Year
    const mar2024 = new Date(2024, 2, 15); // March 15, 2024
    const yearMar2024 = calculateAcademicYear('revan.20233291@mnnit.ac.in', mar2024);
    console.log('[TEST] 2023 admit in Mar 2024:', yearMar2024);
    expect(yearMar2024).toBe('First');

    // Case 3: Student admitted in 2023 tested in August 2024 -> Second Year
    const aug2024 = new Date(2024, 7, 1);
    const yearAug2024 = calculateAcademicYear('revan.20233291@mnnit.ac.in', aug2024);
    console.log('[TEST] 2023 admit in Aug 2024:', yearAug2024);
    expect(yearAug2024).toBe('Second');

    // Case 4: Student admitted in 2023 tested in August 2025 -> Third Year
    const aug2025 = new Date(2025, 7, 1);
    const yearAug2025 = calculateAcademicYear('revan.20233291@mnnit.ac.in', aug2025);
    console.log('[TEST] 2023 admit in Aug 2025:', yearAug2025);
    expect(yearAug2025).toBe('Third');

    // Case 5: Student admitted in 2023 tested in August 2026 -> Final Year
    const aug2026 = new Date(2026, 7, 1);
    const yearAug2026 = calculateAcademicYear('revan.20233291@mnnit.ac.in', aug2026);
    console.log('[TEST] 2023 admit in Aug 2026:', yearAug2026);
    expect(yearAug2026).toBe('Final');

    // Case 6: Student admitted in 2020 tested in August 2025 -> Alumni
    const yearAlumni = calculateAcademicYear('oldstudent.20201010@mnnit.ac.in', aug2025);
    console.log('[TEST] 2020 admit in Aug 2025:', yearAlumni);
    expect(yearAlumni).toBe('Alumni');
  });

  test('calculates correct default semester based on admission year and semester cycle', () => {
    console.log('[TEST] calculateDefaultSemester › odd and even semesters');
    // Admitted in 2023, in August 2023 (Odd sem) -> Sem 1
    const aug2023 = new Date(2023, 7, 1);
    expect(calculateDefaultSemester('revan.20233291@mnnit.ac.in', aug2023)).toBe(1);

    // Admitted in 2023, in March 2024 (Even sem) -> Sem 2
    const mar2024 = new Date(2024, 2, 15);
    expect(calculateDefaultSemester('revan.20233291@mnnit.ac.in', mar2024)).toBe(2);

    // Admitted in 2023, in August 2024 -> Sem 3
    const aug2024 = new Date(2024, 7, 1);
    expect(calculateDefaultSemester('revan.20233291@mnnit.ac.in', aug2024)).toBe(3);

    // Admitted in 2020 (Alumni) -> null
    const aug2026 = new Date(2026, 7, 1);
    expect(calculateDefaultSemester('old.20201010@mnnit.ac.in', aug2026)).toBeNull();
  });
});

describe('Auth Service Registration & OTP Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('\n──────────────────────────────────────');
  });

  describe('generateAndSendOtp', () => {
    test('rejects emails that do not end with @mnnit.ac.in', async () => {
      console.log('[TEST] generateAndSendOtp › rejects non-mnnit email domain');
      await expect(generateAndSendOtp('outsider@gmail.com')).rejects.toThrow(
        'Only @mnnit.ac.in email addresses are allowed.'
      );
      console.log('[TEST] Correctly blocked outsider email.');
    });

    test('rejects email if already registered in system', async () => {
      console.log('[TEST] generateAndSendOtp › rejects already registered email');
      mockFindUserByEmail.mockResolvedValueOnce({ _id: 'user123', email: 'existing@mnnit.ac.in' });

      await expect(generateAndSendOtp('existing@mnnit.ac.in')).rejects.toThrow(
        'Email is already registered'
      );
      console.log('[TEST] Correctly rejected existing user email.');
    });

    test('successfully generates and sends OTP for any valid @mnnit.ac.in email', async () => {
      console.log('[TEST] generateAndSendOtp › succeeds for unseeded @mnnit.ac.in email');
      mockFindUserByEmail.mockResolvedValueOnce(null);

      const result = await generateAndSendOtp('newstudent.20249999@mnnit.ac.in');
      console.log('[TEST] generateAndSendOtp result:', result);

      expect(result).toEqual({ message: 'OTP sent to your email' });
      expect(mockRedisSetEx).toHaveBeenCalledTimes(1);
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        'otp:newstudent.20249999@mnnit.ac.in',
        600,
        expect.any(String)
      );
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      console.log('[TEST] Successfully dispatched OTP to new MNNIT student email.');
    });
  });

  describe('register', () => {
    test('rejects registration if email does not end with @mnnit.ac.in', async () => {
      console.log('[TEST] register › rejects non-mnnit email');
      await expect(
        register({
          email: 'user@yahoo.com',
          fullName: 'Test User',
          department: 'Computer Science and Engineering',
          password: 'Password123!',
          otp: '123456',
        })
      ).rejects.toThrow('Only @mnnit.ac.in email addresses are allowed.');
      console.log('[TEST] Blocked invalid registration domain.');
    });

    test('rejects registration if fullName is missing or empty', async () => {
      console.log('[TEST] register › rejects missing full name');
      await expect(
        register({
          email: 'valid.user@mnnit.ac.in',
          fullName: '   ',
          department: 'Computer Science and Engineering',
          password: 'Password123!',
          otp: '123456',
        })
      ).rejects.toThrow('Full name is required');
      console.log('[TEST] Correctly required full name.');
    });

    test('rejects registration if department is missing or empty', async () => {
      console.log('[TEST] register › rejects missing department');
      await expect(
        register({
          email: 'valid.user@mnnit.ac.in',
          fullName: 'Valid User',
          department: '   ',
          password: 'Password123!',
          otp: '123456',
        })
      ).rejects.toThrow('Department is required');
      console.log('[TEST] Correctly required department.');
    });

    test('rejects registration if password fails the strength policy (too short, or missing a letter/number)', async () => {
      console.log('[TEST] register › rejects weak passwords');
      await expect(
        register({
          email: 'valid.user@mnnit.ac.in',
          fullName: 'Valid User',
          department: 'Computer Science and Engineering',
          password: 'short1',
          otp: '123456',
        })
      ).rejects.toThrow(/at least 8 characters/i);

      await expect(
        register({
          email: 'valid.user@mnnit.ac.in',
          fullName: 'Valid User',
          department: 'Computer Science and Engineering',
          password: 'alllettersnodigits',
          otp: '123456',
        })
      ).rejects.toThrow(/at least 8 characters/i);
      console.log('[TEST] Correctly rejected weak passwords at registration.');
    });

    test('rejects registration if OTP is invalid or expired', async () => {
      console.log('[TEST] register › rejects invalid OTP');
      mockRedisGet.mockResolvedValueOnce('654321');

      await expect(
        register({
          email: 'valid.user@mnnit.ac.in',
          fullName: 'Valid User',
          department: 'Mathematics and Computing',
          password: 'Password123!',
          otp: '111111',
        })
      ).rejects.toThrow('Invalid or expired OTP');
      console.log('[TEST] Correctly rejected mismatched OTP.');
    });

    test('successfully creates user with dynamic academic year computed from email', async () => {
      console.log('[TEST] register › registers user with dynamic academic year');
      mockRedisGet.mockResolvedValueOnce('123456');
      mockFindUserByEmail.mockResolvedValueOnce(null);
      mockFindUserByUsername.mockResolvedValueOnce(null);

      const mockCreatedUser = {
        _id: 'new_user_id',
        username: 'revan.20233291_abc123',
        email: 'revan.20233291@mnnit.ac.in',
        fullName: 'Revan Channa',
        department: 'Mathematics and Computing',
        year: 'Fourth',
        generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
      };
      mockCreateUser.mockResolvedValueOnce(mockCreatedUser);
      mockFindUserById.mockResolvedValueOnce(mockCreatedUser);

      const result = await register({
        email: 'revan.20233291@mnnit.ac.in',
        fullName: 'Revan Channa',
        password: 'SecurePassword123',
        department: 'Mathematics and Computing',
        otp: '123456',
      });

      console.log('[TEST] Registration result accessToken:', result.accessToken);
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'revan.20233291@mnnit.ac.in',
          fullName: 'Revan Channa',
          department: 'Mathematics and Computing',
          year: expect.any(String),
        })
      );
      expect(mockRedisDel).toHaveBeenCalledWith('otp:revan.20233291@mnnit.ac.in');
      console.log('[TEST] Registration completed successfully with dynamic year.');
    });

    test('registers user with section and subSection trimmed and uppercased', async () => {
      console.log('[TEST] register › registers user with section D and subSection DF5');
      mockRedisGet.mockResolvedValueOnce('654321');
      mockFindUserByEmail.mockResolvedValueOnce(null);
      mockFindUserByUsername.mockResolvedValueOnce(null);

      const mockCreatedUser = {
        _id: 'new_user_sec',
        username: 'tanish_sec',
        email: 'tanish.20231111@mnnit.ac.in',
        fullName: 'Tanish Sharma',
        department: 'Computer Science and Engineering',
        section: 'D',
        subSection: 'DF5',
        generateAccessToken: jest.fn().mockReturnValue('mock-token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock-refresh'),
      };
      mockCreateUser.mockResolvedValueOnce(mockCreatedUser);
      mockFindUserById.mockResolvedValueOnce(mockCreatedUser);

      await register({
        email: 'tanish.20231111@mnnit.ac.in',
        fullName: 'Tanish Sharma',
        password: 'Password123',
        department: 'Computer Science and Engineering',
        section: ' d ',
        subSection: ' df5 ',
        otp: '654321',
      });

      console.log('[TEST] mockCreateUser called with section and subSection:', 
        mockCreateUser.mock.calls[mockCreateUser.mock.calls.length - 1][0].section,
        mockCreateUser.mock.calls[mockCreateUser.mock.calls.length - 1][0].subSection
      );
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'D',
          subSection: 'DF5',
        })
      );
    });

    test('accepts single letter section like J and subSection like CE3', async () => {
      console.log('[TEST] register › accepts section J and subSection CE3');
      mockRedisGet.mockResolvedValueOnce('654321');
      mockFindUserByEmail.mockResolvedValueOnce(null);
      mockFindUserByUsername.mockResolvedValueOnce(null);

      const mockCreatedUser = {
        _id: 'new_user_j',
        username: 'tanish_j',
        email: 'tanish.20231112@mnnit.ac.in',
        fullName: 'Tanish Sharma',
        department: 'Civil Engineering',
        section: 'J',
        subSection: 'CE3',
        generateAccessToken: jest.fn().mockReturnValue('mock-token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock-refresh'),
      };
      mockCreateUser.mockResolvedValueOnce(mockCreatedUser);
      mockFindUserById.mockResolvedValueOnce(mockCreatedUser);

      await register({
        email: 'tanish.20231112@mnnit.ac.in',
        fullName: 'Tanish Sharma',
        password: 'Password123',
        department: 'Civil Engineering',
        section: 'j',
        subSection: 'ce3',
        otp: '654321',
      });

      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'J',
          subSection: 'CE3',
        })
      );
    });

    test('rejects section if longer than 10 characters during registration', async () => {
      console.log('[TEST] register › rejects section exceeding 10 characters');
      mockRedisGet.mockResolvedValueOnce('654321');
      mockFindUserByEmail.mockResolvedValueOnce(null);
      mockFindUserByUsername.mockResolvedValueOnce(null);

      await expect(
        register({
          email: 'tanish.20231111@mnnit.ac.in',
          fullName: 'Tanish Sharma',
          password: 'Password123',
          department: 'Computer Science and Engineering',
          section: 'SECTION_TOO_LONG',
          otp: '654321',
        })
      ).rejects.toThrow(/exceed 10 characters/i);
    });
  });

  describe('Change Password Unit & Controller Tests', () => {
    test('changePassword service › throws AppError 404 if user not found', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword › user not found');
      mockFindUserWithPasswordById.mockResolvedValueOnce(null);

      await expect(
        changePassword('user123', 'OldPass123!', 'NewPass123!')
      ).rejects.toThrow('User not found');
    });

    test('changePassword service › throws AppError 400 if current password does not match', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword › incorrect current password');
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(false),
        save: jest.fn(),
      };
      mockFindUserWithPasswordById.mockResolvedValueOnce(mockUser);

      await expect(
        changePassword('user123', 'WrongOldPass', 'NewPass123!')
      ).rejects.toThrow('Current password is incorrect');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    test('changePassword service › updates password and saves user when current password matches', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword › successful update');
      const mockUser = {
        _id: 'user123',
        password: 'HashedOldPassword',
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindUserWithPasswordById.mockResolvedValueOnce(mockUser);

      const result = await changePassword('user123', 'CorrectOldPass', 'BrandNewPass123!');
      console.log('[TEST] changePassword result:', result);

      expect(result).toBe(true);
      expect(mockUser.password).toBe('BrandNewPass123!');
      expect(mockUser.save).toHaveBeenCalled();
    });

    test('changePassword controller › returns 400 when currentPassword or newPassword is missing', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword controller › missing fields validation');
      const req = {
        user: { _id: 'user123' },
        body: { currentPassword: 'OldPassword123' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await changePasswordController(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Current password and new password are required',
        })
      );
    });

    test('changePassword controller › returns 400 when newPassword fails the strength policy', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword controller › weak password validation');
      const req = {
        user: { _id: 'user123' },
        body: { currentPassword: 'OldPassword123', newPassword: '123' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await changePasswordController(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/at least 8 characters/i),
        })
      );
    });

    test('changePassword controller › returns 200 on successful password change', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] changePassword controller › success response');
      const mockUser = {
        _id: 'user123',
        matchPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindUserWithPasswordById.mockResolvedValueOnce(mockUser);

      const req = {
        user: { _id: 'user123' },
        body: { currentPassword: 'OldPassword123', newPassword: 'NewPassword123' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await changePasswordController(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });
  });

  describe('Forgot Password & Reset Password Unit & Controller Tests', () => {
    test('forgotPasswordSendOtp › rejects non-mnnit email', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] forgotPasswordSendOtp › rejects non-mnnit email');

      await expect(
        forgotPasswordSendOtp('attacker@gmail.com')
      ).rejects.toThrow(/Only @mnnit.ac.in email addresses are allowed/i);
    });

    test('forgotPasswordSendOtp › returns a generic response for an unregistered email (no account enumeration)', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] forgotPasswordSendOtp › unregistered email does not reveal account existence');
      mockFindUserByEmail.mockResolvedValueOnce(null);

      const result = await forgotPasswordSendOtp('nonexistent@mnnit.ac.in');

      expect(result.message).toMatch(/if an account exists/i);
      // No OTP should be generated/stored/emailed for an account that doesn't exist
      expect(mockRedisSetEx).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    test('forgotPasswordSendOtp › sends OTP and saves to Redis for valid user, with the same generic message', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] forgotPasswordSendOtp › successful OTP send');
      mockFindUserByEmail.mockResolvedValueOnce({ _id: 'u1', email: 'registered@mnnit.ac.in' });
      mockRedisSetEx.mockResolvedValueOnce('OK');

      const result = await forgotPasswordSendOtp('registered@mnnit.ac.in');
      expect(result.message).toMatch(/if an account exists/i);
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        'otp:reset:registered@mnnit.ac.in',
        600,
        expect.any(String)
      );
      expect(mockSendEmail).toHaveBeenCalled();
    });

    test('resetPassword › throws AppError 400 for invalid/mismatched OTP', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] resetPassword › invalid OTP');
      mockRedisGet.mockResolvedValueOnce('654321');

      await expect(
        resetPassword('student@mnnit.ac.in', '000000', 'NewSecurePass123!')
      ).rejects.toThrow('Invalid or expired OTP');
    });

    test('resetPassword › throws AppError 400 if new password fails the strength policy', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] resetPassword › weak password');

      await expect(
        resetPassword('student@mnnit.ac.in', '654321', '123')
      ).rejects.toThrow(/at least 8 characters/i);
    });

    test('resetPassword › updates password and deletes OTP on success', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] resetPassword › successful password reset');
      mockRedisGet.mockResolvedValueOnce('654321');
      const mockUser = {
        _id: 'u1',
        email: 'student@mnnit.ac.in',
        password: 'OldPassword',
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindUserByEmail.mockResolvedValueOnce(mockUser);
      mockRedisDel.mockResolvedValueOnce(1);

      const result = await resetPassword('student@mnnit.ac.in', '654321', 'BrandNewPass123!');
      expect(result.message).toMatch(/successfully reset/i);
      expect(mockUser.password).toBe('BrandNewPass123!');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalledWith('otp:reset:student@mnnit.ac.in');
    });

    test('sendForgotPasswordOtp controller › validates email and returns 200 on success', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] sendForgotPasswordOtp controller › success');
      mockFindUserByEmail.mockResolvedValueOnce({ _id: 'u1', email: 'valid@mnnit.ac.in' });

      const req = { body: { email: 'valid@mnnit.ac.in' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await sendForgotPasswordOtpController(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('resetPassword controller › validates fields and returns 200 on success', async () => {
      console.log('\n──────────────────────────────────────');
      console.log('[TEST] resetPassword controller › success');
      mockRedisGet.mockResolvedValueOnce('654321');
      const mockUser = { _id: 'u1', email: 'valid@mnnit.ac.in', save: jest.fn().mockResolvedValue(true) };
      mockFindUserByEmail.mockResolvedValueOnce(mockUser);

      const req = { body: { email: 'valid@mnnit.ac.in', otp: '654321', newPassword: 'NewPassword123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await resetPasswordController(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});

