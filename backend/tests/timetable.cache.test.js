import { jest } from '@jest/globals';

// ─── In-memory Redis stand-in (enough for the cache helper) ──────────────────
const store = new Map();
const fakeRedis = {
  isReady: true,
  get: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  setEx: jest.fn(async (k, _ttl, v) => { store.set(k, v); }),
  del: jest.fn(async (keys) => { [].concat(keys).forEach((k) => store.delete(k)); }),
  incr: jest.fn(async (k) => { const n = Number(store.get(k) || 0) + 1; store.set(k, String(n)); return n; }),
};
jest.unstable_mockModule('../src/utils/redis.js', () => ({ getRedisClient: () => fakeRedis }));

// ─── Gemini stand-in that counts calls ───────────────────────────────────────
const mockGenerateContent = jest.fn();
jest.unstable_mockModule('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = { generateContent: mockGenerateContent };
    }
  },
}));

const mockTimetableFindOne = jest.fn();
jest.unstable_mockModule('../src/models/timetable.model.js', () => ({
  Timetable: {
    findOne: (...args) => ({ lean: () => mockTimetableFindOne(...args) }),
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'tt1' }),
    findOneAndDelete: jest.fn().mockResolvedValue({ _id: 'tt1' }),
  },
}));
jest.unstable_mockModule('../src/models/attendance.model.js', () => ({
  AttendanceCourse: { findOne: jest.fn(), create: jest.fn(), updateOne: jest.fn(), deleteMany: jest.fn() },
}));
jest.unstable_mockModule('../src/models/schedule.model.js', () => ({ Schedule: { deleteMany: jest.fn() } }));

const { parseTimetablePdf, getUserTimetable, abandonTimetable } = await import('../src/services/timetable.service.js');

// One official timetable document containing two sections' classes.
const geminiJson = JSON.stringify({
  branch: 'Computer Science & Engineering',
  semester: 4,
  classes: [
    { day: 'Monday', startTime: '09:00', endTime: '10:00', courseCode: 'CS1', subjectName: 'Algorithms', classType: 'Lecture', section: 'CSA', location: 'GS1', professor: 'Dr A' },
    { day: 'Tuesday', startTime: '10:00', endTime: '11:00', courseCode: 'CS2', subjectName: 'Databases', classType: 'Lecture', section: 'CSB', location: 'GS2', professor: 'Dr B' },
  ],
});
const geminiResponse = () => ({ text: geminiJson });

const pdf = (label) => Buffer.from(`%PDF-1.4 ${label}`);

describe('Timetable parsing & reads — caching', () => {
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockImplementation(async () => geminiResponse());
  });

  test('two students uploading the SAME official timetable cost ONE Gemini call, yet each gets their own section', async () => {
    console.log('[TEST] parse cache › same file, different sections → 1 Gemini call, correct per-student filtering');
    const file = pdf('official-cse-sem4');

    const studentA = await parseTimetablePdf(file, { section: 'CSA' }, 'application/pdf');
    const studentB = await parseTimetablePdf(file, { section: 'CSB' }, 'application/pdf');

    console.log(`[TEST RESULT] Gemini calls=${mockGenerateContent.mock.calls.length}, A got "${studentA.classes[0].subjectName}", B got "${studentB.classes[0].subjectName}"`);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(studentA.classes.map((c) => c.subjectName)).toEqual(['Algorithms']);
    expect(studentB.classes.map((c) => c.subjectName)).toEqual(['Databases']);
  });

  test('a different file is a cache miss and calls Gemini again', async () => {
    console.log('[TEST] parse cache › different content → separate call');
    await parseTimetablePdf(pdf('file-one'), { section: 'CSA' }, 'application/pdf');
    await parseTimetablePdf(pdf('file-two'), { section: 'CSA' }, 'application/pdf');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  test('simultaneous uploads of the same file share a single in-flight Gemini call (thundering herd)', async () => {
    console.log('[TEST] parse cache › 25 concurrent identical uploads → 1 Gemini call');
    mockGenerateContent.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return geminiResponse();
    });
    const file = pdf('everyone-uploads-at-9am');

    const results = await Promise.all(
      Array.from({ length: 25 }, () => parseTimetablePdf(file, { section: 'CSA' }, 'application/pdf'))
    );

    console.log(`[TEST RESULT] Gemini calls=${mockGenerateContent.mock.calls.length} for ${results.length} uploads`);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.classes.length === 1)).toBe(true);
  });

  test('a failed extraction is NOT cached, so the next upload retries Gemini', async () => {
    console.log('[TEST] parse cache › errors are never cached');
    const file = pdf('flaky');
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify({ classes: [] }) });

    await expect(parseTimetablePdf(file, { section: 'CSA' }, 'application/pdf')).rejects.toMatchObject({ statusCode: 400 });
    const retry = await parseTimetablePdf(file, { section: 'CSA' }, 'application/pdf');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(retry.classes).toHaveLength(1);
  });

  test('the cached entry contains no per-student data (safe to share between users)', async () => {
    await parseTimetablePdf(pdf('shared'), { section: 'CSA', department: 'Secret Dept', semester: 8 }, 'application/pdf');
    const [entryKey] = [...store.keys()].filter((k) => k.startsWith('timetable:parse:'));
    const entry = JSON.parse(store.get(entryKey));
    console.log(`[TEST RESULT] cached entry keys: ${Object.keys(entry).join(',')}`);
    expect(Object.keys(entry).sort()).toEqual(['branch', 'classes', 'semester']);
    expect(JSON.stringify(entry)).not.toMatch(/Secret Dept/);
  });

  test('works normally (just uncached) when Redis is unavailable', async () => {
    console.log('[TEST] parse cache › Redis down → still parses, each upload calls Gemini');
    fakeRedis.isReady = false;
    try {
      await parseTimetablePdf(pdf('no-redis'), { section: 'CSA' }, 'application/pdf');
      await parseTimetablePdf(pdf('no-redis'), { section: 'CSA' }, 'application/pdf');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    } finally {
      fakeRedis.isReady = true;
    }
  });

  test("getUserTimetable is cached per user and cleared when the timetable is abandoned", async () => {
    console.log('[TEST] user timetable cache › read-through then invalidated on delete');
    mockTimetableFindOne.mockResolvedValue({ _id: 'tt1', classes: [{ title: 'x' }] });

    await getUserTimetable('user1');
    await getUserTimetable('user1');
    expect(mockTimetableFindOne).toHaveBeenCalledTimes(1);

    await getUserTimetable('user2');
    expect(mockTimetableFindOne).toHaveBeenCalledTimes(2);

    await abandonTimetable('user1');
    await getUserTimetable('user1');
    expect(mockTimetableFindOne).toHaveBeenCalledTimes(3);
  });

  test("a user with no timetable is not cached as 'none' (so a fresh upload shows up immediately)", async () => {
    mockTimetableFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'tt2', classes: [] });
    expect(await getUserTimetable('u9')).toBeNull();
    expect(await getUserTimetable('u9')).toMatchObject({ _id: 'tt2' });
  });
});
