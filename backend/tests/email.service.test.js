import { jest } from '@jest/globals';

/**
 * Email goes through Brevo's HTTPS API only (the Gmail SMTP fallback was
 * removed). These tests stub fetch and check what is sent, how failures
 * surface, and that recipient addresses never reach the logs in full.
 */

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: logger }));

const { sendEmail, sendContactFormEmail } = await import('../src/utils/email.service.js');

const ENV = { ...process.env };
const brevoReply = (ok, body) => ({ ok, status: ok ? 201 : 401, json: async () => body });
const logged = () => [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls].flat().join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ENV, NODE_ENV: 'production', BREVO_API_KEY: 'key-123', EMAIL_FROM: 'noreply@linklet.org' };
  global.fetch = jest.fn().mockResolvedValue(brevoReply(true, { messageId: 'm1' }));
});
afterAll(() => {
  process.env = ENV;
});

describe('sendEmail (verification codes)', () => {
  it('sends through Brevo from EMAIL_FROM with the code in both bodies', async () => {
    await sendEmail('student@mnnit.ac.in', 'Your code', 'Your code is 123456');

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('key-123');
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: 'Linklet', email: 'noreply@linklet.org' });
    expect(body.to).toEqual([{ email: 'student@mnnit.ac.in' }]);
    expect(body.textContent).toBe('Your code is 123456');
    expect(body.htmlContent).toContain('123456');
  });

  it('falls back to EMAIL_USER as the sender address', async () => {
    delete process.env.EMAIL_FROM;
    process.env.EMAIL_USER = 'founders@example.com';
    await sendEmail('a@b.com', 's', 'code 111111');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).sender.email).toBe('founders@example.com');
  });

  it('turns a Brevo rejection into a user-facing 500 and logs the reason', async () => {
    global.fetch.mockResolvedValue(brevoReply(false, { message: 'unrecognised IP address' }));
    await expect(sendEmail('student@mnnit.ac.in', 's', 'code 123456')).rejects.toMatchObject({ statusCode: 500 });
    expect(logged()).toContain('unrecognised IP address');
  });

  it('never logs a full recipient address', async () => {
    await sendEmail('student@mnnit.ac.in', 's', 'code 123456');
    global.fetch.mockResolvedValue(brevoReply(false, {}));
    await sendEmail('student@mnnit.ac.in', 's', 'code 123456').catch(() => {});
    expect(logged()).not.toContain('student@mnnit.ac.in');
    expect(logged()).toContain('st***@mnnit.ac.in');
  });

  it('fails in production when no Brevo key is configured', async () => {
    delete process.env.BREVO_API_KEY;
    await expect(sendEmail('a@b.com', 's', 'code 123456')).rejects.toMatchObject({ statusCode: 500 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('only prints the email in local development without a key', async () => {
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;
    await expect(sendEmail('a@b.com', 's', 'code 123456')).resolves.toEqual({ messageId: 'local-dev' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('sendContactFormEmail', () => {
  const form = { name: 'Asha <b>', email: 'asha@mnnit.ac.in', category: 'Bug', subject: 'Hi', message: '<script>x</script>' };

  it('delivers to the receiver with Reply-To set to the sender, HTML-escaped', async () => {
    process.env.CONTACT_RECEIVER_EMAIL = 'team@linklet.org';
    const result = await sendContactFormEmail(form);

    expect(result).toEqual({ success: true, messageId: 'm1', provider: 'brevo' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.to[0].email).toBe('team@linklet.org');
    expect(body.replyTo).toEqual({ email: 'asha@mnnit.ac.in', name: 'Asha <b>' });
    expect(body.htmlContent).toContain('&lt;script&gt;');
    expect(body.htmlContent).not.toContain('<script>');
  });

  it('throws when Brevo fails (no silent fallback)', async () => {
    global.fetch.mockResolvedValue(brevoReply(false, { message: 'down' }));
    await expect(sendContactFormEmail(form)).rejects.toMatchObject({ statusCode: 500 });
  });
});
