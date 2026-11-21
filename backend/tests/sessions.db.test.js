import { jest } from "@jest/globals";
import { startTestDb, stopTestDb, clearTestDb, oid } from "./helpers/mongo.js";

/**
 * Per-device sessions on a real MongoDB, through the auth service: each sign-in
 * is its own session, refresh tokens rotate atomically, a just-rotated token
 * gets a short grace period (two tabs refreshing at once), pre-sessions logins
 * migrate, and only hashes are stored.
 */

process.env.ACCESS_TOKEN_SECRET = "access-secret";
process.env.REFRESH_TOKEN_SECRET = "refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = "15m";
process.env.REFRESH_TOKEN_EXPIRY = "7d";

jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// No Redis in this test: user cache and token blacklist are no-ops.
jest.unstable_mockModule("../src/utils/userCache.js", () => ({
  getCachedUser: jest.fn(),
  setCachedUser: jest.fn(),
  invalidateUserCache: jest.fn(),
}));
jest.unstable_mockModule("../src/utils/blacklist.js", () => ({
  blacklistToken: jest.fn(),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
}));

const { User } = await import("../models/users.js");
const repo = await import("../src/repositories/user.repository.js");
const authService = await import("../src/services/auth.service.js");

let user;
const signIn = async () => {
  const doc = await User.findById(user._id);
  const refreshToken = doc.generateRefreshToken();
  await repo.addSession(user._id, refreshToken);
  return refreshToken;
};
const sessionsOf = async () => (await User.findById(user._id).select("+sessions").lean()).sessions || [];

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  user = await User.create({
    _id: oid(),
    username: "asha",
    fullName: "Asha",
    email: "asha.2023@mnnit.ac.in",
    password: "Password123",
  });
});

describe("sessions", () => {
  it("keeps each device signed in independently", async () => {
    const phone = await signIn();
    const laptop = await signIn();

    const fromPhone = await authService.refresh(phone);
    const fromLaptop = await authService.refresh(laptop);

    expect(fromPhone.refreshToken).toBeTruthy();
    expect(fromLaptop.refreshToken).toBeTruthy();
    expect(await sessionsOf()).toHaveLength(2);
  });

  it("stores only hashes, never the tokens", async () => {
    const token = await signIn();
    const [session] = await sessionsOf();
    expect(session.tokenHash).toBe(repo.hashToken(token));
    expect(JSON.stringify(await User.findById(user._id).select("+sessions").lean())).not.toContain(token);
  });

  it("rotates: the new token works, the old one only within the grace period", async () => {
    const original = await signIn();
    const { refreshToken: next } = await authService.refresh(original);

    // Second tab, same moment, old cookie: gets an access token, keeps the new refresh cookie.
    const secondTab = await authService.refresh(original);
    expect(secondTab.accessToken).toBeTruthy();
    expect(secondTab.refreshToken).toBeNull();

    // After the grace period the old token is dead.
    await User.updateOne({ _id: user._id }, { $set: { "sessions.0.rotatedAt": new Date(Date.now() - repo.ROTATION_GRACE_MS - 1000) } });
    await expect(authService.refresh(original)).rejects.toMatchObject({ statusCode: 401 });

    // The current token still rotates normally.
    await expect(authService.refresh(next)).resolves.toMatchObject({ refreshToken: expect.any(String) });
  });

  it("migrates a login from before sessions existed, once", async () => {
    const doc = await User.findById(user._id);
    const legacy = doc.generateRefreshToken();
    await User.updateOne({ _id: user._id }, { $set: { refreshToken: legacy } });

    const { refreshToken } = await authService.refresh(legacy);
    expect(refreshToken).toBeTruthy();
    expect((await User.findById(user._id).lean()).refreshToken).toBeUndefined();
    expect(await sessionsOf()).toHaveLength(1);
    await authService.refresh(refreshToken); // the migrated session keeps rotating
  });

  it("rejects a token that was never a session", async () => {
    const doc = await User.findById(user._id);
    await expect(authService.refresh(doc.generateRefreshToken())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("logout ends only this device's session", async () => {
    const phone = await signIn();
    const laptop = await signIn();
    await authService.logout(user._id, null, phone);

    await expect(authService.refresh(phone)).rejects.toMatchObject({ statusCode: 401 });
    await expect(authService.refresh(laptop)).resolves.toMatchObject({ refreshToken: expect.any(String) });
  });

  it("changing the password signs out other devices but keeps this one", async () => {
    const other = await signIn();
    const tokens = await authService.changePassword(user._id, "Password123", "NewPassword456");

    await expect(authService.refresh(other)).rejects.toMatchObject({ statusCode: 401 });
    await expect(authService.refresh(tokens.refreshToken)).resolves.toMatchObject({ refreshToken: expect.any(String) });
  });

  it("keeps at most the 10 most recent devices", async () => {
    const first = await signIn();
    for (let i = 0; i < repo.MAX_SESSIONS; i++) await signIn();
    expect(await sessionsOf()).toHaveLength(repo.MAX_SESSIONS);
    await expect(authService.refresh(first)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("never returns sessions with a user", async () => {
    await signIn();
    expect((await User.findById(user._id).lean()).sessions).toBeUndefined();
  });
});
