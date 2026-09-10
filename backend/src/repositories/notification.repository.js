import { Notification } from "../models/notification.model.js";

/**
 * Create a new notification document and populate sender details.
 */
export const createNotification = async (data) => {
  const notification = await Notification.create(data);
  return await Notification.findById(notification._id)
    .populate("sender", "username fullName avatar")
    .lean();
};

/**
 * Fetch paginated notifications for a recipient.
 */
export const getUserNotifications = async (
  userId,
  { page = 1, limit = 15, unreadOnly = false } = {}
) => {
  const query = { recipient: userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [notifications, totalDocs, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("sender", "username fullName avatar")
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    totalDocs,
    totalPages: Math.ceil(totalDocs / limit) || 1,
    page: Number(page),
    limit: Number(limit),
    unreadCount,
  };
};

/**
 * Get count of unread notifications for a user.
 */
export const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Mark a single notification as read.
 */
export const markAsRead = async (notificationId, userId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  )
    .populate("sender", "username fullName avatar")
    .lean();
};

/**
 * Mark all unread notifications for a user as read.
 */
export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return result;
};

/**
 * Delete a specific notification.
 */
export const deleteNotification = async (notificationId, userId) => {
  return await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });
};

/**
 * Delete all read notifications for a user.
 */
export const clearReadNotifications = async (userId) => {
  return await Notification.deleteMany({
    recipient: userId,
    isRead: true,
  });
};

/**
 * Find recent similar notification within a time window for deduplication / rate limiting.
 */
export const findRecentSimilar = async (
  recipient,
  type,
  entityId,
  timeWindowMs = 60000
) => {
  const since = new Date(Date.now() - timeWindowMs);
  return await Notification.findOne({
    recipient,
    type,
    entityId,
    createdAt: { $gte: since },
  }).lean();
};
