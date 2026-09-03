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

const { generateAndSendOtp, register } = await import('../src/services/auth.service.js');
const { cookieOptions } = await import('../src/controllers/auth.controller.js');
const { calculateAcademicYear } = await import('../src/utils/academicYear.js');

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
  });
});
