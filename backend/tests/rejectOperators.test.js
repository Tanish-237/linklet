import express from 'express';
import supertest from 'supertest';
import { rejectOperatorKeys, hasOperatorKey } from '../src/middlewares/rejectOperators.middleware.js';

/**
 * Bodies with MongoDB operator keys are refused before any controller can pass
 * them into a query (NoSQL injection), at any nesting depth.
 */
const app = express();
app.use(express.json());
app.use(rejectOperatorKeys);
app.post('/', (req, res) => res.json({ ok: true }));

describe('rejectOperatorKeys', () => {
  it.each([
    [{ email: { $gt: '' } }],
    [{ chatId: { $ne: null } }],
    [{ a: { b: [{ c: { $where: '1' } }] } }],
    [{ $or: [{ a: 1 }] }],
  ])('rejects %j', async (body) => {
    const res = await supertest(app).post('/').send(body);
    expect(res.status).toBe(400);
  });

  it('lets ordinary bodies through, including "$" inside values', async () => {
    const res = await supertest(app).post('/').send({ content: 'costs $5', tags: ['a', 'b'], nested: { price: '$10' } });
    expect(res.status).toBe(200);
  });

  it('handles empty, array and primitive bodies', () => {
    expect(hasOperatorKey(undefined)).toBe(false);
    expect(hasOperatorKey({})).toBe(false);
    expect(hasOperatorKey([{ ok: 1 }])).toBe(false);
    expect(hasOperatorKey('$ne')).toBe(false);
  });
});
