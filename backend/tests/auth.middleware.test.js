import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

// Mock redis
const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn().mockResolvedValue("OK");
const mockRedisDel = jest.fn().mockResolvedValue(1);

const mockGetRedisClient = jest.fn(() => ({
  get: mockRedisGet,
  setEx: mockRedisSetEx,
  del: mockRedisDel,
}));

jest.unstable_mockModule("../src/utils/redis.js", () => ({
  getRedisClient: mockGetRedisClient,
  connectRedis: jest.fn(),
}));

// Mock blacklist
const mockIsTokenBlacklisted = jest.fn().mockResolvedValue(false);
jest.unstable_mockModule("../src/utils/blacklist.js", () => ({
  isTokenBlacklisted: mockIsTokenBlacklisted,
  blacklistToken: jest.fn(),
}));

// Mock User model
const mockFindById = jest.fn();
jest.unstable_mockModule("../models/users.js", () => ({
  User: {
    findById: mockFindById,
  },
}));

// Import modules under test
const { isLoggedIn, optionalAuth } = await import("../src/middlewares/auth.middleware.js");
const { invalidateUserCache } = await import("../src/utils/userCache.js");

describe("Auth Middleware & Redis User Cache Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ACCESS_TOKEN_SECRET: "test-secret" };
    mockIsTokenBlacklisted.mockResolvedValue(false);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("isLoggedIn › cache hit: retrieves user from Redis without querying MongoDB", async () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] isLoggedIn › cache hit returns user from Redis");

    const userId = "user123";
    const cachedUser = { _id: userId, username: "cached_hero", role: "student" };
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedUser));

    const token = jwt.sign({ id: userId }, "test-secret");
    const req = {
      cookies: { accesstoken: token },
      header: jest.fn().mockReturnValue(null),
    };
    const res = {};
    const next = jest.fn();

    await isLoggedIn(req, res, next);

    console.log("[TEST] next() called without errors:", next.mock.calls.length === 1);
    console.log("[TEST] req.user set to:", req.user);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(cachedUser);
    expect(mockRedisGet).toHaveBeenCalledWith(`user:cache:${userId}`);
    expect(mockFindById).not.toHaveBeenCalled(); // MongoDB was NOT queried!
  });

  test("isLoggedIn › cache miss: queries MongoDB and saves sanitized user to Redis", async () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] isLoggedIn › cache miss queries MongoDB and writes to Redis");

    const userId = "user456";
    mockRedisGet.mockResolvedValue(null); // Cache miss

    const dbUser = { _id: userId, username: "mongo_user", role: "admin" };
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(dbUser),
      }),
    });

    const token = jwt.sign({ id: userId }, "test-secret");
    const req = {
      cookies: { accesstoken: token },
      header: jest.fn().mockReturnValue(null),
    };
    const res = {};
    const next = jest.fn();

    await isLoggedIn(req, res, next);

    console.log("[TEST] MongoDB query executed:", mockFindById.mock.calls.length === 1);
    console.log("[TEST] Redis setEx called with key:", mockRedisSetEx.mock.calls[0]?.[0]);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(dbUser);
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      `user:cache:${userId}`,
      300,
      JSON.stringify(dbUser)
    );
  });

  test("isLoggedIn › Redis error gracefully falls back to MongoDB query", async () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] isLoggedIn › Redis error gracefully falls back to MongoDB");

    const userId = "user789";
    mockRedisGet.mockRejectedValue(new Error("Redis connection timed out"));

    const dbUser = { _id: userId, username: "resilient_user", role: "student" };
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(dbUser),
      }),
    });

    const token = jwt.sign({ id: userId }, "test-secret");
    const req = {
      cookies: { accesstoken: token },
      header: jest.fn().mockReturnValue(null),
    };
    const res = {};
    const next = jest.fn();

    await isLoggedIn(req, res, next);

    console.log("[TEST] Successfully fell back to MongoDB despite Redis error");
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(dbUser);
  });

  test("invalidateUserCache › calls redis.del for the user cache key", async () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] invalidateUserCache › deletes user from Redis");

    await invalidateUserCache("user-to-invalidate");

    console.log("[TEST] redis.del called with:", mockRedisDel.mock.calls);
    expect(mockRedisDel).toHaveBeenCalledWith("user:cache:user-to-invalidate");
  });

  test("optionalAuth › populates req.user from cache when token is valid", async () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] optionalAuth › populates req.user from cache");

    const userId = "userOpt1";
    const cachedUser = { _id: userId, username: "optional_user" };
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedUser));

    const token = jwt.sign({ id: userId }, "test-secret");
    const req = {
      cookies: { accesstoken: token },
      header: jest.fn().mockReturnValue(null),
    };
    const res = {};
    const next = jest.fn();

    await optionalAuth(req, res, next);

    console.log("[TEST] optionalAuth populated req.user:", req.user);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(cachedUser);
  });
});
