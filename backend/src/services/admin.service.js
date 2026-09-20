import * as userRepository from "../repositories/user.repository.js";
import { User } from "../../models/users.js";
import { Resource } from "../../models/resource.js";
import { Post } from "../../models/posts.js";
import { Question } from "../../models/question.js";
import { Answer } from "../../models/answer.js";
import { Branch } from "../models/branch.model.js";
import { getRedisClient } from "../utils/redis.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { invalidateUserCache } from "../utils/userCache.js";
import { logAdminAction, getAuditLogs } from "./auditLog.service.js";
import { invalidateResourceCache } from "./resource.service.js";

const STATS_CACHE_KEY = "admin:stats:cache";
const STATS_CACHE_TTL = 60; // 60 seconds

/**
 * Fetch aggregated platform metrics and KPIs.
 * Uses Redis caching with a short TTL to ensure high throughput.
 */
export const getPlatformStats = async () => {
  try {
    const redis = getRedisClient();
    if (redis) {
      const cached = await redis.get(STATS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logger.debug?.(`Redis get stats error: ${err.message}`);
  }

  const [
    totalUsers,
    adminUsers,
    regularUsers,
    totalResources,
    totalPosts,
    totalQuestions,
    totalAnswers,
    totalBranches,
    downloadsAggregate,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ role: "user" }),
    Resource.countDocuments(),
    Post.countDocuments(),
    Question.countDocuments(),
    Answer.countDocuments(),
    Branch.countDocuments(),
    Resource.aggregate([
      { $group: { _id: null, totalDownloads: { $sum: "$downloadsCount" } } },
    ]),
  ]);

  const totalDownloads = downloadsAggregate[0]?.totalDownloads || 0;

  const stats = {
    users: {
      total: totalUsers,
      admins: adminUsers,
      students: regularUsers,
    },
    resources: {
      total: totalResources,
      downloads: totalDownloads,
    },
    community: {
      posts: totalPosts,
      questions: totalQuestions,
      answers: totalAnswers,
      discussions: totalQuestions + totalAnswers,
    },
    academic: {
      branches: totalBranches,
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.setEx(STATS_CACHE_KEY, STATS_CACHE_TTL, JSON.stringify(stats));
    }
  } catch (err) {
    logger.debug?.(`Redis set stats error: ${err.message}`);
  }

  return stats;
};

/**
 * Fetch paginated, searchable user directory for administrators.
 */
export const getUsersDirectory = async (filters) => {
  return await userRepository.getUsersDirectory(filters);
};

/**
 * Update user role with self-lockout safeguards.
 */
export const assignRoleAndBranch = async (targetUserId, role, adminUserId = null) => {
  const validRoles = ["user", "admin"];
  if (!validRoles.includes(role)) {
    throw new AppError("Invalid role specified", 400);
  }

  // Self-lockout prevention: An active admin cannot demote their own account
  if (adminUserId && adminUserId.toString() === targetUserId.toString() && role !== "admin") {
    throw new AppError("You cannot demote your own admin account", 400);
  }

  // Platform-lockout prevention: demoting the LAST remaining admin would leave
  // no one able to manage the platform (or even promote a new admin back).
  if (role !== "admin") {
    const targetUser = await userRepository.findUserById(targetUserId);
    if (targetUser?.role === "admin") {
      const adminCount = await userRepository.countUsers({ role: "admin" });
      if (adminCount <= 1) {
        throw new AppError("Cannot demote the only remaining administrator", 400);
      }
    }
  }

  const updateData = { role };

  const updatedUser = await userRepository.updateUserById(targetUserId, updateData);
  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  // Invalidate stats and user cache so changes reflect immediately
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(STATS_CACHE_KEY);
    }
    await invalidateUserCache(targetUserId);
  } catch (err) {
    logger.debug?.(`Redis invalidate stats error: ${err.message}`);
  }

  // Audit log
  if (adminUserId) {
    await logAdminAction({
      adminId: adminUserId,
      action: role === "admin" ? "PROMOTE_USER" : "DEMOTE_USER",
      targetType: "User",
      targetId: targetUserId,
      details: { role, targetUsername: updatedUser.username },
    });

    // Notify user of role update
    import("./notification.service.js")
      .then(({ createAndPushNotification }) => {
        createAndPushNotification({
          recipient: targetUserId,
          sender: adminUserId,
          type: "SYSTEM_ALERT",
          title: "Account Role Updated",
          message:
            role === "admin"
              ? "Congratulations! You have been granted Administrator privileges on Linklet."
              : "Your account role has been updated to Student by an administrator.",
          link: "/dashboard",
          entityId: targetUserId,
          entityType: "User",
        });
      })
      .catch(() => {});
  }

  return updatedUser;
};

/**
 * Suspend or reactivate user account with self-lockout safeguards and audit logging.
 */
export const setUserBanStatus = async (adminUserId, targetUserId, isBanned, banReason = "") => {
  // Self-lockout prevention: An active admin cannot ban their own account
  if (adminUserId && adminUserId.toString() === targetUserId.toString()) {
    throw new AppError("You cannot suspend your own admin account", 400);
  }

  const updatedUser = await userRepository.updateUserBanStatus(targetUserId, isBanned, banReason);
  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  // Invalidate user profile cache in Redis
  await invalidateUserCache(targetUserId);

  // Audit log
  if (adminUserId) {
    await logAdminAction({
      adminId: adminUserId,
      action: isBanned ? "BAN_USER" : "UNBAN_USER",
      targetType: "User",
      targetId: targetUserId,
      details: {
        isBanned: Boolean(isBanned),
        banReason: banReason ? banReason.trim() : "",
        targetUsername: updatedUser.username,
      },
    });
  }

  return updatedUser;
};

/**
 * Retrieve administrative audit logs.
 */
export const getAdminAuditLogs = async (query) => {
  return await getAuditLogs(query);
};


/**
 * Fetch recent platform activity across resources, questions, and posts.
 */
export const getRecentContentOverview = async (limit = 5) => {
  const parsedLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

  const [recentResources, recentQuestions, recentPosts] = await Promise.all([
    Resource.find()
      .select("title category fileName downloadsCount createdAt branch")
      .populate("userId", "username fullName avatar")
      .populate("branch", "name")
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean(),
    Question.find()
      .select("title category answersCount upvotes isClosed createdAt")
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean(),
    Post.find()
      .select("caption image upvotes commentsCount createdAt")
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean(),
  ]);

  return {
    recentResources,
    recentQuestions,
    recentPosts,
  };
};

/**
 * Hide or re-approve a resource in the public library. Resources are visible
 * immediately on upload; this is post-publish moderation, not a review queue.
 */
export const setResourceVerification = async (adminUserId, resourceId, isVerified) => {
  const resource = await Resource.findByIdAndUpdate(
    resourceId,
    { $set: { isVerified: Boolean(isVerified) } },
    { new: true }
  )
    .populate("userId", "username fullName avatar")
    .lean();

  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  // Hidden resources drop out of the library's category counts.
  await invalidateResourceCache();

  if (adminUserId) {
    await logAdminAction({
      adminId: adminUserId,
      action: isVerified ? "APPROVE_RESOURCE" : "HIDE_RESOURCE",
      targetType: "Resource",
      targetId: resourceId,
      details: { title: resource.title, ownerId: resource.userId?._id },
    });

    const ownerId = resource.userId?._id || resource.userId;
    if (ownerId && !isVerified) {
      try {
        const { createAndPushNotification } = await import("./notification.service.js");
        await createAndPushNotification({
          recipient: ownerId,
          sender: adminUserId,
          type: "SYSTEM_ALERT",
          title: "Content Moderated",
          message: `Your study resource "${resource.title}" was hidden by an administrator for content moderation.`,
          link: "/dashboard/global-search",
          entityId: null,
          entityType: "System",
        });
      } catch (e) {
        logger.warn(`Failed to notify resource owner of moderation: ${e.message}`);
      }
    }
  }

  return resource;
};
