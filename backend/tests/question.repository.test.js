import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindByIdAndUpdate = jest.fn();
const mockFindById = jest.fn();

jest.unstable_mockModule('../models/question.js', () => ({
  Question: {
    findByIdAndUpdate: mockFindByIdAndUpdate,
    findById: mockFindById,
  },
}));

jest.unstable_mockModule('../models/users.js', () => ({
  User: {},
}));

const questionRepository = await import('../src/repositories/question.repository.js');

// Both queries chain three/four .populate() calls before resolving — build a
// thenable that records every populate() call's args and resolves to a
// sentinel document, mirroring the chain pattern in post.repository.test.js.
const makePopulateChain = (resolvedValue, calls) => {
  const chain = {
    populate: jest.fn((...args) => {
      calls.push(args);
      return chain;
    }),
    then: (resolve) => resolve(resolvedValue),
  };
  return chain;
};

describe('Question Repository — answers populate() safety cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findQuestionByIdAndIncrementViews caps populated answers via perDocumentLimit, so one viral question cannot pull an unbounded number of documents into a single response', async () => {
    console.log('[TEST] findQuestionByIdAndIncrementViews › answers populate() carries a perDocumentLimit safety cap');
    const populateCalls = [];
    mockFindByIdAndUpdate.mockReturnValue(makePopulateChain({ _id: 'q1' }, populateCalls));

    await questionRepository.findQuestionByIdAndIncrementViews('507f1f77bcf86cd799439011');

    const answersPopulateCall = populateCalls.find((args) => args[0]?.path === 'answers');
    expect(answersPopulateCall).toBeDefined();
    expect(answersPopulateCall[0].options.perDocumentLimit).toBe(300);
  });

  it('findQuestionById caps populated answers via perDocumentLimit', async () => {
    console.log('[TEST] findQuestionById › answers populate() carries a perDocumentLimit safety cap');
    const populateCalls = [];
    mockFindById.mockReturnValue(makePopulateChain({ _id: 'q1' }, populateCalls));

    await questionRepository.findQuestionById('507f1f77bcf86cd799439011');

    const answersPopulateCall = populateCalls.find((args) => args[0]?.path === 'answers');
    expect(answersPopulateCall).toBeDefined();
    expect(answersPopulateCall[0].options.perDocumentLimit).toBe(300);
  });

  it('returns null for an invalid ObjectId without querying the database', async () => {
    console.log('[TEST] findQuestionById/findQuestionByIdAndIncrementViews › short-circuit on malformed id');
    expect(await questionRepository.findQuestionById('not-a-valid-id')).toBeNull();
    expect(await questionRepository.findQuestionByIdAndIncrementViews('not-a-valid-id')).toBeNull();
    expect(mockFindById).not.toHaveBeenCalled();
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });
});
