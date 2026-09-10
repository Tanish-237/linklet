import { apiClient } from "./apiClient";

/**
 * Fetch paginated notifications with optional unread filter.
 */
export const getNotifications = async ({
  page = 1,
  limit = 15,
  unreadOnly = false,
} = {}) => {
  const params = new URLSearchParams();
  if (page) params.append("page", page);
  if (limit) params.append("limit", limit);
  if (unreadOnly) params.append("unreadOnly", "true");

  const response = await apiClient.get(`/notifications?${params.toString()}`);
  return response.data;
};

/**
 * Fetch current unread notifications count.
 */
export const getUnreadCount = async () => {
  const response = await apiClient.get("/notifications/unread-count");
  return response.data?.data?.unreadCount ?? 0;
};

/**
 * Mark a single notification as read.
 */
export const markNotificationRead = async (notificationId) => {
  const response = await apiClient.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

/**
 * Mark all unread notifications as read.
 */
export const markAllNotificationsRead = async () => {
  const response = await apiClient.patch("/notifications/read-all");
  return response.data;
};

/**
 * Delete a specific notification.
 */
export const deleteNotification = async (notificationId) => {
  const response = await apiClient.delete(`/notifications/${notificationId}`);
  return response.data;
};

/**
 * Delete all read notifications.
 */
export const clearReadNotifications = async () => {
  const response = await apiClient.delete("/notifications/clear-read");
  return response.data;
};
