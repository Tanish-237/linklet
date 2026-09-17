import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockContactMessageCreate = jest.fn();
const mockSendContactFormEmail = jest.fn();

jest.unstable_mockModule('../src/models/contactMessage.model.js', () => ({
  ContactMessage: {
    create: mockContactMessageCreate,
  },
}));

jest.unstable_mockModule('../src/utils/email.service.js', () => ({
  sendContactFormEmail: mockSendContactFormEmail,
}));

// Load routes after mocks are defined
const contactRoutes = (await import('../src/routes/contact.routes.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/contact', contactRoutes);

// Global error handler for test app
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message,
  });
});

describe('Contact Form API & Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects request when name is missing', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/contact › Rejects request when name is missing');

    const res = await supertest(app)
      .post('/api/v1/contact')
      .send({
        email: 'student@example.com',
        message: 'Need help with timetable schedule.',
      });

    console.log(`[TEST RESULT] Status: ${res.status}, Error Message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/name is required/i);
    expect(mockContactMessageCreate).not.toHaveBeenCalled();
  });

  test('rejects request when email is missing or invalid', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/contact › Rejects invalid email format');

    const res = await supertest(app)
      .post('/api/v1/contact')
      .send({
        name: 'Tanish',
        email: 'invalid-email-address',
        message: 'Hello founders',
      });

    console.log(`[TEST RESULT] Status: ${res.status}, Error Message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/valid email address/i);
    expect(mockContactMessageCreate).not.toHaveBeenCalled();
  });

  test('rejects request when message is missing', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/contact › Rejects missing message content');

    const res = await supertest(app)
      .post('/api/v1/contact')
      .send({
        name: 'Tanish',
        email: 'tanish@gmail.com',
        message: '   ',
      });

    console.log(`[TEST RESULT] Status: ${res.status}, Error Message: ${res.body.message}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/message is required/i);
    expect(mockContactMessageCreate).not.toHaveBeenCalled();
  });

  test('successfully saves message to DB and dispatches email to founders with replyTo set to user', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/contact › Saves submission and dispatches email notification');

    const mockSavedDoc = {
      _id: 'mockContactId123',
      name: 'Rohan Sharma',
      email: 'rohan@gmail.com',
      category: 'Contribute to Linklet',
      subject: 'Interested in React Frontend',
      message: 'I want to contribute components to Linklet repository.',
      emailSent: false,
      save: jest.fn().mockResolvedValue(true),
    };

    mockContactMessageCreate.mockResolvedValue(mockSavedDoc);
    mockSendContactFormEmail.mockResolvedValue({ success: true, messageId: 'msg_98765' });

    const payload = {
      name: 'Rohan Sharma',
      email: 'rohan@gmail.com',
      category: 'Contribute to Linklet',
      subject: 'Interested in React Frontend',
      message: 'I want to contribute components to Linklet repository.',
    };

    const res = await supertest(app)
      .post('/api/v1/contact')
      .send(payload);

    console.log(`[TEST RESULT] Status: ${res.status}, Response:`, res.body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mockContactId123');

    // Verify DB creation
    expect(mockContactMessageCreate).toHaveBeenCalledWith({
      name: 'Rohan Sharma',
      email: 'rohan@gmail.com',
      category: 'Contribute to Linklet',
      subject: 'Interested in React Frontend',
      message: 'I want to contribute components to Linklet repository.',
    });

    // Verify email dispatch with replyTo details
    expect(mockSendContactFormEmail).toHaveBeenCalledWith({
      name: 'Rohan Sharma',
      email: 'rohan@gmail.com',
      category: 'Contribute to Linklet',
      subject: 'Interested in React Frontend',
      message: 'I want to contribute components to Linklet repository.',
    });

    expect(mockSavedDoc.emailSent).toBe(true);
    expect(mockSavedDoc.save).toHaveBeenCalled();
  });

  test('persists message in DB even if email dispatch fails temporarily', async () => {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('[TEST] POST /api/v1/contact › Resilient DB save when email provider has error');

    const mockSavedDoc = {
      _id: 'mockContactId456',
      name: 'Priya Patel',
      email: 'priya@gmail.com',
      category: 'Timetable Issue',
      subject: 'ECE Slot Clash',
      message: 'Class clash between Slot A and Slot D.',
      emailSent: false,
      save: jest.fn().mockResolvedValue(true),
    };

    mockContactMessageCreate.mockResolvedValue(mockSavedDoc);
    mockSendContactFormEmail.mockRejectedValue(new Error('Brevo quota exceeded'));

    const payload = {
      name: 'Priya Patel',
      email: 'priya@gmail.com',
      category: 'Timetable Issue',
      subject: 'ECE Slot Clash',
      message: 'Class clash between Slot A and Slot D.',
    };

    const res = await supertest(app)
      .post('/api/v1/contact')
      .send(payload);

    console.log(`[TEST RESULT] Status: ${res.status}, Response:`, res.body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('mockContactId456');

    // Verify document was updated with error info
    expect(mockSavedDoc.emailSent).toBe(false);
    expect(mockSavedDoc.emailError).toBe('Brevo quota exceeded');
    expect(mockSavedDoc.save).toHaveBeenCalled();
  });
});
