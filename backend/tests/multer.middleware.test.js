import { fileFilter } from '../src/middlewares/multer.middleware.js';

describe('multer.middleware fileFilter', () => {
  test('accepts a file type that was previously blocked (e.g. .exe / unrecognized mimetype)', (done) => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] fileFilter › accepts a previously-unsupported file type (.exe)');

    const file = { mimetype: 'application/x-msdownload', originalname: 'installer.exe' };

    fileFilter({}, file, (err, accept) => {
      console.log(`[TEST RESULT] err: ${err}, accepted: ${accept}`);
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  test('accepts a file with no recognizable extension at all', (done) => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] fileFilter › accepts a file with an arbitrary/unknown extension');

    const file = { mimetype: 'application/octet-stream', originalname: 'weird-file.xyz123' };

    fileFilter({}, file, (err, accept) => {
      console.log(`[TEST RESULT] err: ${err}, accepted: ${accept}`);
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  test('still accepts previously-allowed types (pdf) for backwards compatibility', (done) => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] fileFilter › still accepts a standard PDF upload');

    const file = { mimetype: 'application/pdf', originalname: 'notes.pdf' };

    fileFilter({}, file, (err, accept) => {
      console.log(`[TEST RESULT] err: ${err}, accepted: ${accept}`);
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });
});
