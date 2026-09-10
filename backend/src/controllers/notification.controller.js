import * as notificationService from "../services/notification.service.js";

export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 15,
      unreadOnly: unreadOnly === "true",
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page,
      limit: result.limit,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user._id);
    res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const result = await notificationService.markAsRead(
      notificationId,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: result.notification,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const result = await notificationService.deleteNotification(
      notificationId,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Notification deleted",
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const clearRead = async (req, res, next) => {
  try {
    await notificationService.clearReadNotifications(req.user._id);
    res.status(200).json({
      success: true,
      message: "Read notifications cleared",
    });
  } catch (error) {
    next(error);
  }
};
