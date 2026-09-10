import express from "express";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", isLoggedIn, getNotifications);
router.get("/unread-count", isLoggedIn, getUnreadCount);
router.patch("/read-all", isLoggedIn, markAllAsRead);
router.patch("/:notificationId/read", isLoggedIn, markAsRead);
router.delete("/clear-read", isLoggedIn, clearRead);
router.delete("/:notificationId", isLoggedIn, deleteNotification);

export default router;
