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

export const updateRefreshToken = async (id, token) => {
  return await User.findByIdAndUpdate(id, { refreshToken: token });
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


