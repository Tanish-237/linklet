import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockUploadAndParseTimetable = jest.fn((req, res) => {
  res.status(200).json({ success: true, data: {} });
});

jest.unstable_mockModule('../src/controllers/timetable.controller.js', () => ({
  uploadAndParseTimetable: mockUploadAndParseTimetable,
  confirmTimetable: jest.fn((req, res) => res.status(200).json({ success: true })),
  getTimetable: jest.fn((req, res) => res.status(200).json({ success: true })),
  deleteTimetable: jest.fn((req, res) => res.status(200).json({ success: true })),
}));

const currentUser = { _id: 'gemini-cost-test-user' };

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  isLoggedIn: (req, res, next) => {
    req.user = currentUser;
    next();
  },
  optionalAuth: (req, res, next) => next(),
}));

const timetableRoutes = (await import('../src/routes/timetable.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/timetable', timetableRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ success: false, message: err.message || 'Internal Server Error' });
});

const request = supertest(app);

describe('Timetable Upload Rate Limiting (Gemini API cost exposure)', () => {
  test('allows uploads under the per-user hourly cap', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/timetable/upload-preview › allows requests under the cap');

    const res = await request.post('/api/v1/timetable/upload-preview').attach('timetable', Buffer.from('fake'), 'schedule.png');

    console.log(`[TEST RESULT] Status: ${res.status}`);
    expect(res.status).toBe(200);
    expect(mockUploadAndParseTimetable).toHaveBeenCalledTimes(1);
  });

  test('rejects further uploads once the per-user hourly cap (20) is exceeded, protecting the paid Gemini API from abuse', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/timetable/upload-preview › blocks requests once the cap is hit');

    let lastStatus;
    for (let i = 0; i < 21; i++) {
      const res = await request.post('/api/v1/timetable/upload-preview').attach('timetable', Buffer.from('fake'), 'schedule.png');
      lastStatus = res.status;
    }

    console.log(`[TEST RESULT] Final (21st) request status: ${lastStatus}`);
    expect(lastStatus).toBe(429);
  });
});
