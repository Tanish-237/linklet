import crypto from "crypto";
import { User } from "../../models/users.js";
import { invalidateUserCache } from "../utils/userCache.js";

export const createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username });
};

export const findUserById = async (id) => {
  return await User.findById(id).select("-password -refreshToken");
};

export const findNotificationPrefsById = async (id) => {
  return await User.findById(id).select("notificationPrefs").lean();
};

export const findUserWithPasswordById = async (id) => {
  return await User.findById(id);
};

export const updateUserById = async (id, updateData) => {
  const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select("-password");
  if (id) {
    await invalidateUserCache(id);
  }
  return updatedUser;
};

// ─── Sessions (one per signed-in device) ─────────────────────────────────────
// Only SHA-256 hashes of refresh tokens are stored, so a database leak doesn't
// hand out working sessions.

export const MAX_SESSIONS = 10;
// How long a just-rotated token still works, for a second tab that sent the
// same (old) refresh cookie a moment after the first tab rotated it.
export const ROTATION_GRACE_MS = 30_000;

export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

/** Start a session for a new sign-in. Keeps the most recent MAX_SESSIONS devices. */
export const addSession = async (userId, refreshToken) => {
  const now = new Date();
  await User.updateOne(
    { _id: userId },
    { $push: { sessions: { $each: [{ tokenHash: hashToken(refreshToken), createdAt: now, lastUsedAt: now }], $slice: -MAX_SESSIONS } } }
  );
};

/**
 * Swap a session's refresh token for a new one, atomically, so the same old
 * token can't be rotated twice. Returns true if `oldToken` was a live session.
 */
export const rotateSession = async (userId, oldToken, newToken) => {
  const oldHash = hashToken(oldToken);
  const now = new Date();
  const res = await User.updateOne(
    { _id: userId, "sessions.tokenHash": oldHash },
    {
      $set: {
        "sessions.$.tokenHash": hashToken(newToken),
        "sessions.$.prevTokenHash": oldHash,
        "sessions.$.rotatedAt": now,
        "sessions.$.lastUsedAt": now,
      },
    }
  );
  return res.modifiedCount === 1;
};

/** Was `token` the one a session replaced within the last ROTATION_GRACE_MS? */
export const wasJustRotated = async (userId, token) => {
  const found = await User.exists({
    _id: userId,
    sessions: {
      $elemMatch: { prevTokenHash: hashToken(token), rotatedAt: { $gte: new Date(Date.now() - ROTATION_GRACE_MS) } },
    },
  });
  return Boolean(found);
};

/**
 * Move a still-valid legacy (pre-sessions) refresh token into a session with a
 * new token. Returns true if `oldToken` matched the legacy field.
 */
export const migrateLegacySession = async (userId, oldToken, newToken) => {
  const now = new Date();
  const res = await User.updateOne(
    { _id: userId, refreshToken: oldToken },
    {
      $unset: { refreshToken: 1 },
      $push: { sessions: { $each: [{ tokenHash: hashToken(newToken), createdAt: now, lastUsedAt: now }], $slice: -MAX_SESSIONS } },
    }
  );
  return res.modifiedCount === 1;
};

/** Sign out one device. */
export const removeSession = async (userId, refreshToken) => {
  if (!refreshToken) return;
  const hash = hashToken(refreshToken);
  await User.updateOne({ _id: userId }, { $pull: { sessions: { $or: [{ tokenHash: hash }, { prevTokenHash: hash }] } } });
  await User.updateOne({ _id: userId, refreshToken }, { $unset: { refreshToken: 1 } });
};

/** Sign out every device (password change or reset). */
export const clearSessions = async (userId) => {
  await User.updateOne({ _id: userId }, { $set: { sessions: [] }, $unset: { refreshToken: 1 } });
};

/**
 * Get paginated and filtered users for admin user directory.
 */
export const getUsersDirectory = async ({ search = "", role = "", branch = "", page = 1, limit = 10 }) => {
  const query = {};

  if (role && ["user", "admin"].includes(role)) {
    query.role = role;
  }

  if (branch) {
    query.branch = branch;
  }

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    query.$or = [
      { username: regex },
      { fullName: regex },
      { email: regex },
    ];
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const [users, totalDocs] = await Promise.all([
    User.find(query)
      .select("-password -refreshToken")
      .populate("branch", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    User.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalDocs / parsedLimit) || 1;
  const hasNextPage = parsedPage < totalPages;

  return {
    users,
    totalDocs,
    totalPages,
    page: parsedPage,
    limit: parsedLimit,
    hasNextPage,
  };
};

export const countUsers = async (filter = {}) => {
  return await User.countDocuments(filter);
};

export const updateUserBanStatus = async (userId, isBanned, banReason = "") => {
  return await User.findByIdAndUpdate(
    userId,
    { $set: { isBanned: Boolean(isBanned), banReason: banReason ? banReason.trim() : "" } },
    { new: true }
  )
    .select("-password -refreshToken")
    .populate("branch", "name")
    .lean();
};


