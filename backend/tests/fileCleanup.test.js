import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const mockCloudinaryUpload = jest.fn();

jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: mockCloudinaryUpload,
    },
  },
}));

// Mock logger to keep test output clean while testing
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { uploadOnCloudinary } = await import('../src/utils/cloudinary.js');
const {
  removeLocalFile,
  cleanupRequestFiles,
  fileCleanupMiddleware,
} = await import('../src/middlewares/fileCleanup.middleware.js');

describe('File Cleanup & Cloudinary Upload Tests', () => {
  const testDir = path.join(process.cwd(), 'tests', 'scratch_temp');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createTempFile = (fileName = `temp-${Date.now()}-${Math.random()}.txt`) => {
    const filePath = path.join(testDir, fileName);
    fs.writeFileSync(filePath, 'sample test file content for upload test');
    return filePath;
  };

  describe('uploadOnCloudinary unit tests', () => {
    it('returns null when filepath is empty or undefined', async () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] uploadOnCloudinary › handles empty/null filepath');
      const resultNull = await uploadOnCloudinary(null);
      const resultEmpty = await uploadOnCloudinary('');
      expect(resultNull).toBeNull();
      expect(resultEmpty).toBeNull();
      expect(mockCloudinaryUpload).not.toHaveBeenCalled();
      console.log('[TEST] Verified empty/null filepath handled safely');
    });

    it('successfully uploads to Cloudinary and deletes the local temp file', async () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] uploadOnCloudinary › unlinks local file after successful upload');
      const tempFile = createTempFile();
      expect(fs.existsSync(tempFile)).toBe(true);

      mockCloudinaryUpload.mockResolvedValue({
        secure_url: 'https://cloudinary.com/test-success.png',
        public_id: 'test-public-id-123',
      });

      const response = await uploadOnCloudinary(tempFile);

      expect(response).toBeDefined();
      expect(response.secure_url).toBe('https://cloudinary.com/test-success.png');
      expect(mockCloudinaryUpload).toHaveBeenCalledWith(tempFile, {
        resource_type: 'auto',
      });

      // Verify file was deleted from local disk
      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] Verified local file was deleted after successful upload');
    });

    it('deletes local file and returns null when Cloudinary upload fails', async () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] uploadOnCloudinary › unlinks local file when Cloudinary throws an error');
      const tempFile = createTempFile();
      expect(fs.existsSync(tempFile)).toBe(true);

      mockCloudinaryUpload.mockRejectedValue(new Error('Cloudinary connection timed out'));

      const response = await uploadOnCloudinary(tempFile);

      expect(response).toBeNull();
      // Verify file was cleaned up on error
      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] Verified local file was deleted after Cloudinary upload failure');
    });
  });

  describe('removeLocalFile and cleanupRequestFiles helper tests', () => {
    it('removeLocalFile deletes existing file without error', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] removeLocalFile › safely deletes existing file');
      const tempFile = createTempFile();
      expect(fs.existsSync(tempFile)).toBe(true);

      removeLocalFile(tempFile);
      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] removeLocalFile confirmed deletion');
    });

    it('removeLocalFile handles non-existent file gracefully without throwing', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] removeLocalFile › does not throw when file does not exist');
      const nonExistentPath = path.join(testDir, 'does-not-exist.tmp');
      expect(() => removeLocalFile(nonExistentPath)).not.toThrow();
      console.log('[TEST] removeLocalFile handled missing file safely');
    });

    it('cleanupRequestFiles deletes single file from req.file', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] cleanupRequestFiles › deletes single file from req.file');
      const tempFile = createTempFile();
      const mockReq = { file: { path: tempFile } };

      cleanupRequestFiles(mockReq);
      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] Verified req.file was unlinked');
    });

    it('cleanupRequestFiles deletes multiple files from req.files array and object', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] cleanupRequestFiles › deletes multiple files from req.files array');
      const tempFile1 = createTempFile();
      const tempFile2 = createTempFile();
      const mockReqArray = {
        files: [{ path: tempFile1 }, { path: tempFile2 }],
      };

      cleanupRequestFiles(mockReqArray);
      expect(fs.existsSync(tempFile1)).toBe(false);
      expect(fs.existsSync(tempFile2)).toBe(false);
      console.log('[TEST] Verified req.files array files were unlinked');

      const tempFile3 = createTempFile();
      const mockReqObject = {
        files: {
          documents: [{ path: tempFile3 }],
        },
      };
      cleanupRequestFiles(mockReqObject);
      expect(fs.existsSync(tempFile3)).toBe(false);
      console.log('[TEST] Verified req.files object dictionary files were unlinked');
    });
  });

  describe('fileCleanupMiddleware tests', () => {
    it('registers on finish and deletes remaining temp files on response finish', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] fileCleanupMiddleware › deletes unhandled temp file on res finish');
      const tempFile = createTempFile();
      expect(fs.existsSync(tempFile)).toBe(true);

      const mockReq = { file: { path: tempFile } };
      const mockRes = new EventEmitter();
      const mockNext = jest.fn();

      fileCleanupMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Simulate response finishing
      mockRes.emit('finish');

      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] Verified lingering temp file was deleted on response finish');
    });

    it('registers on close and deletes remaining temp files on connection abort', () => {
      console.log('\n──────────────────────────────────────────');
      console.log('[TEST] fileCleanupMiddleware › deletes unhandled temp file on res close/abort');
      const tempFile = createTempFile();
      expect(fs.existsSync(tempFile)).toBe(true);

      const mockReq = { file: { path: tempFile } };
      const mockRes = new EventEmitter();
      const mockNext = jest.fn();

      fileCleanupMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Simulate client disconnecting/aborting
      mockRes.emit('close');

      expect(fs.existsSync(tempFile)).toBe(false);
      console.log('[TEST] Verified lingering temp file was deleted on response close');
    });
  });
});
