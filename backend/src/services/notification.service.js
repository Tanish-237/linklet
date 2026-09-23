import mongoose from "mongoose";
import * as notificationRepository from "../repositories/notification.repository.js";
import { getRedisClient } from "../utils/redis.js";
import logger from "../utils/logger.js";
import { AppError } from "../utils/error.js";
import { getCachedUser } from "../utils/userCache.js";
import { findNotificationPrefsById } from "../repositories/user.repository.js";
import { NOTIFICATION_TYPE_PREF } from "../config/constants.js";

const REDIS_UNREAD_PREFIX = "user:unread_notifs:";
const REDIS_TTL_SECONDS = 120; // 2 minutes cache TTL

const getSafeRedis = () => {
  try {
    return getRedisClient();
  } catch {
    return null;
  }
};

/**
 * Emit Socket.io event safely to a recipient room
 */
const emitSocketEvent = async (recipientId, eventName, payload) => {
  try {
    const { getIo } = await import("../../socket.js");
    const io = getIo();
    if (io) {
      io.to(recipientId.toString()).emit(eventName, payload);
    }
  } catch (err) {
    // Socket not initialized (e.g. during test runs) or client disconnected
    logger.debug(`Socket notification emit skipped: ${err.message}`);
  }
};

/**
 * Invalidate cached unread count in Redis
 */
const invalidateUnreadCache = async (userId) => {
  const redis = getSafeRedis();
  if (redis) {
    try {
      await redis.del(`${REDIS_UNREAD_PREFIX}${userId.toString()}`);
    } catch (e) {
      logger.warn(`Redis cache invalidation error: ${e.message}`);
    }
  }
};

/**
 * True if the recipient has switched off the Settings category this
 * notification type belongs to. Reads the auth-middleware user cache first
 * (it already holds notificationPrefs) and only hits Mongo on a cache miss.
 * Any lookup failure errs on the side of delivering the notification.
 */
const isSilencedByRecipient = async (recipient, type) => {
  const prefKey = NOTIFICATION_TYPE_PREF[type];
  if (!prefKey) return false;
  try {
    let prefs = (await getCachedUser(recipient.toString()))?.notificationPrefs;
    if (!prefs && mongoose.connection.readyState === 1) {
      prefs = (await findNotificationPrefsById(recipient))?.notificationPrefs;
    }
    return prefs?.[prefKey] === false;
  } catch (err) {
    logger.warn(`Notification preference lookup failed: ${err.message}`);
    return false;
  }
};

/**
 * Create a new notification, save to DB, update Redis cache, and push real-time socket event.
 */
export const createAndPushNotification = async ({
  recipient,
  sender = null,
  type,
  title,
  message,
  link = "",
  entityId = null,
  entityType = "System",
}) => {
  try {
    if (!recipient || !type || !title || !message) {
      return null;
    }

    // In disconnected test environments, skip DB persistence without hanging on Mongoose buffer
    if (mongoose.connection.readyState !== 1 && !notificationRepository.createNotification?.mock) {
      return null;
    }

    // 1. Never notify a user of their own actions
    if (sender && recipient.toString() === sender.toString()) {
      return null;
    }

    // 2. Respect the recipient's notification preferences
    if (await isSilencedByRecipient(recipient, type)) {
      return null;
    }

    // 3. Throttling / deduplication for high-frequency actions (e.g. likes/unlikes, follow toggles)
    if (
      ["POST_LIKE", "FORUM_UPVOTE", "FORUM_COMMENT", "USER_FOLLOW"].includes(type) &&
      entityId
    ) {
      const existing = await notificationRepository.findRecentSimilar(
        recipient,
        type,
        entityId,
        60000 // 60s deduplication window
      );
      if (existing) {
        return null;
      }
    }

    // 4. Persist notification in MongoDB
    const notification = await notificationRepository.createNotification({
      recipient,
      sender,
      type,
      title,
      message,
      link,
      entityId,
      entityType,
    });

    // 5. Update unread count & cache
    const unreadCount = await notificationRepository.getUnreadCount(recipient);
    const redis = getSafeRedis();
    if (redis) {
      try {
        await redis.setEx(
          `${REDIS_UNREAD_PREFIX}${recipient.toString()}`,
          REDIS_TTL_SECONDS,
          unreadCount.toString()
        );
      } catch (e) {
        logger.warn(`Redis set unread error: ${e.message}`);
      }
    }

    // 6. Targeted real-time delivery to the recipient's personal socket room
    await emitSocketEvent(recipient, "notification:new", {
      notification,
      unreadCount,
    });

    return notification;
  } catch (err) {
    logger.warn(`Failed to create or push notification: ${err.message}`);
    return null;
  }
};

/**
 * Fetch paginated notifications for the authenticated user.
 */
export const getUserNotifications = async (userId, options = {}) => {
  const data = await notificationRepository.getUserNotifications(userId, options);

  // Cache latest unread count in Redis
  const redis = getSafeRedis();
  if (redis) {
    try {
      await redis.setEx(
        `${REDIS_UNREAD_PREFIX}${userId.toString()}`,
        REDIS_TTL_SECONDS,
        data.unreadCount.toString()
      );
    } catch (e) {
      logger.warn(`Redis set unread error: ${e.message}`);
    }
  }

  return data;
};

/**
 * Retrieve unread count with Redis caching.
 */
export const getUnreadCount = async (userId) => {
  const redis = getSafeRedis();
  if (redis) {
    try {
      const cached = await redis.get(`${REDIS_UNREAD_PREFIX}${userId.toString()}`);
      if (cached !== null) {
        return parseInt(cached, 10);
      }
    } catch (e) {
      logger.warn(`Redis get unread error: ${e.message}`);
    }
  }

  const count = await notificationRepository.getUnreadCount(userId);

  if (redis) {
    try {
      await redis.setEx(
        `${REDIS_UNREAD_PREFIX}${userId.toString()}`,
        REDIS_TTL_SECONDS,
        count.toString()
      );
    } catch (e) {
      logger.warn(`Redis set unread error: ${e.message}`);
    }
  }

  return count;
};

/**
 * Mark a single notification as read.
 */
export const markAsRead = async (notificationId, userId) => {
  const updated = await notificationRepository.markAsRead(notificationId, userId);
  if (!updated) {
    throw new AppError("Notification not found", 404);
  }

  await invalidateUnreadCache(userId);
  const unreadCount = await notificationRepository.getUnreadCount(userId);

  await emitSocketEvent(userId, "notification:count_updated", { unreadCount });

  return { notification: updated, unreadCount };
};

/**
 * Mark all notifications for the user as read.
 */
export const markAllAsRead = async (userId) => {
  await notificationRepository.markAllAsRead(userId);

  const redis = getSafeRedis();
  if (redis) {
    try {
      await redis.setEx(
        `${REDIS_UNREAD_PREFIX}${userId.toString()}`,
        REDIS_TTL_SECONDS,
        "0"
      );
    } catch (e) {
      logger.warn(`Redis reset unread error: ${e.message}`);
    }
  }

  await emitSocketEvent(userId, "notification:count_updated", { unreadCount: 0 });

  return { success: true, unreadCount: 0 };
};

/**
 * Delete a specific notification.
 */
export const deleteNotification = async (notificationId, userId) => {
  const deleted = await notificationRepository.deleteNotification(
    notificationId,
    userId
  );
  if (!deleted) {
    throw new AppError("Notification not found", 404);
  }

  await invalidateUnreadCache(userId);
  const unreadCount = await notificationRepository.getUnreadCount(userId);
  await emitSocketEvent(userId, "notification:count_updated", { unreadCount });

  return { success: true, unreadCount };
};

/**
 * Delete all read notifications for the user.
 */
export const clearReadNotifications = async (userId) => {
  await notificationRepository.clearReadNotifications(userId);
  return { success: true };
};
