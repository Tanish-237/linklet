import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFind = jest.fn();

jest.unstable_mockModule('../models/users.js', () => ({
  User: {
    find: mockFind,
  },
}));

jest.unstable_mockModule('../models/chat.js', () => ({
  Chat: {},
  Message: {},
}));

const chatRepository = await import('../src/repositories/chat.repository.js');

const makeSelectChain = (resolvedValue) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(resolvedValue),
  }),
});

describe('Chat Repository — filterExistingUserIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops malformed IDs before querying, instead of letting Mongoose throw a CastError', async () => {
    console.log('[TEST] filterExistingUserIds › malformed id is filtered out, valid id still round-trips to the query');
    const realId = '507f1f77bcf86cd799439011';
    mockFind.mockReturnValue(makeSelectChain([{ _id: realId }]));

    const result = await chatRepository.filterExistingUserIds([realId, 'bogus-id']);

    expect(result).toEqual([realId]);
    // Only the valid ObjectId should ever reach the $in query.
    expect(mockFind).toHaveBeenCalledWith({ _id: { $in: [realId] } });
  });

  it('returns [] without querying when every ID is malformed', async () => {
    console.log('[TEST] filterExistingUserIds › all-bogus input short-circuits with no DB call');
    const result = await chatRepository.filterExistingUserIds(['bogus-1', 'bogus-2']);

    expect(result).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns [] for empty/non-array input', async () => {
    console.log('[TEST] filterExistingUserIds › empty and non-array input short-circuit');
    expect(await chatRepository.filterExistingUserIds([])).toEqual([]);
    expect(await chatRepository.filterExistingUserIds(null)).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });
});
