import express from 'express';
import supertest from 'supertest';

describe('Health Check API Integration Test', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    });
  });

  test('GET /health returns 200 OK with status ok and uptime', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] GET /health › testing health check endpoint');
    const res = await supertest(app).get('/health');
    console.log('[TEST] Health response:', res.body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });
});
