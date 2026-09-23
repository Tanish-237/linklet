import express from "express";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/rbac.js";
import { documentUploadMiddleware } from "../middlewares/multer.middleware.js";
import { fileCleanupMiddleware } from "../middlewares/fileCleanup.middleware.js";
import {
  accessOrCreateChat,
  getUserChats,
  createGroup,
  renameGroup,
  addToGroup,
  removeFromGroup,
  leaveGroup,
  updateGroupImage,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  searchUsers,
  searchMessagesInChat,
  forwardMessages,
  deleteMultipleMessages,
  hideMessages,
  getChatMedia,
  toggleReaction,
  pinMessage,
  unpinMessage,
  reportMessage,
  getReportedMessages,
  updateReportStatus,
  promoteToAdmin,
  demoteAdmin,
  pinChat,
  unpinChat,
  muteChat,
  getMutedChats,
  archiveChat,
  deleteChatForUser,
} from "../controllers/chat.controller.js";

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(isLoggedIn);

// Chat endpoints
router.route("/").post(accessOrCreateChat).get(getUserChats);
router.route("/search").get(searchUsers);

// Pin / Unpin endpoints (pinned MESSAGES within a chat)
router.route("/pin").put(pinMessage);
router.route("/unpin").put(unpinMessage);

// Per-user chat list settings (pinned chat, muted, archived, deleted-for-me)
router.route("/chat-settings/pin").put(pinChat).delete(unpinChat);
router.route("/chat-settings/mute").put(muteChat);
router.route("/chat-settings/muted").get(getMutedChats);
router.route("/chat-settings/archive").put(archiveChat);

// Group endpoints
router.route("/group").post(createGroup);
router.route("/group/rename").put(renameGroup);
router.route("/group/add").put(addToGroup);
router.route("/group/remove").put(removeFromGroup);
router.route("/group/leave").put(leaveGroup);
router.route("/group/promote").put(promoteToAdmin);
router.route("/group/demote").put(demoteAdmin);
router
  .route("/group/image")
  .put(fileCleanupMiddleware, documentUploadMiddleware.single("media"), updateGroupImage);

// Message endpoints
// Note: Literal sub-routes MUST precede parameterized routes (/:chatId, /:messageId)
// to prevent Express from treating literal path segments as route parameters.
router.route("/message/react").post(toggleReaction);
router.route("/message/forward").post(forwardMessages);
router.route("/message/bulk-delete").delete(deleteMultipleMessages).post(deleteMultipleMessages);
router.route("/message/hide").post(hideMessages);
router.route("/message/report").post(reportMessage);
router
  .route("/message/reports")
  .get(requireRole(["admin"]), getReportedMessages)
  .put(requireRole(["admin"]), updateReportStatus);
router.route("/message/read/:chatId").put(markAsRead);
router.route("/message/search/:chatId").get(searchMessagesInChat);
router.route("/message/media/:chatId").get(getChatMedia);

router
  .route("/message")
  .post(fileCleanupMiddleware, documentUploadMiddleware.any(), sendMessage)
  .put(editMessage)
  .delete(deleteMessage);

router.route("/message/:messageId").delete(deleteMessage);
router.route("/message/:chatId").get(getMessages);

// Delete-for-me (1:1: per-user history cutoff; group: leave). Registered last
// since it's a bare parameterized path that would otherwise shadow every
// literal route above it.
router.route("/:chatId").delete(deleteChatForUser);

export default router;
