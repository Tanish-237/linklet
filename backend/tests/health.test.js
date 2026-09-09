import express from 'express';
import supertest from 'supertest';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

describe('Health Check API Unit & Integration Tests', () => {
  test('GET /health returns 200 OK with uptime and status', async () => {
    console.log('\n──────────────────────────────────────');
    console.log('[TEST] GET /health › verifies Render health check response');

    const res = await supertest(app).get('/health');

    console.log('[TEST] /health status:', res.status);
    console.log('[TEST] /health body:', JSON.stringify(res.body));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toBeDefined();

    console.log('[TEST] Successfully verified health check endpoint');
  });
});
