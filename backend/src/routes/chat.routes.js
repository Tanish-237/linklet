import express from "express";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { documentUploadMiddleware } from "../middlewares/multer.middleware.js";
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
  toggleReaction,
  pinMessage,
  unpinMessage,
  reportMessage,
  getReportedMessages,
  updateReportStatus,
  promoteToAdmin,
  demoteAdmin,
} from "../controllers/chat.controller.js";

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(isLoggedIn);

// Chat endpoints
router.route("/").post(accessOrCreateChat).get(getUserChats);
router.route("/search").get(searchUsers);

// Pin / Unpin endpoints
router.route("/pin").put(pinMessage);
router.route("/unpin").put(unpinMessage);

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
  .put(documentUploadMiddleware.single("media"), updateGroupImage);

// Message endpoints
router
  .route("/message")
  .post(documentUploadMiddleware.array("media", 10), sendMessage)
  .put(editMessage)
  .delete(deleteMessage);

router.route("/message/react").post(toggleReaction);
router.route("/message/forward").post(forwardMessages);
router.route("/message/bulk-delete").delete(deleteMultipleMessages).post(deleteMultipleMessages);
router.route("/message/report").post(reportMessage);
router.route("/message/reports").get(getReportedMessages).put(updateReportStatus);
router.route("/message/:messageId").delete(deleteMessage);
router.route("/message/:chatId").get(getMessages);
router.route("/message/read/:chatId").put(markAsRead);
router.route("/message/search/:chatId").get(searchMessagesInChat);

export default router;
