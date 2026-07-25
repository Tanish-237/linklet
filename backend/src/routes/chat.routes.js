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
} from "../controllers/chat.controller.js";

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(isLoggedIn);

// Chat endpoints
router.route("/").post(accessOrCreateChat).get(getUserChats);
router.route("/search").get(searchUsers);

// Group endpoints
router.route("/group").post(createGroup);
router.route("/group/rename").put(renameGroup);
router.route("/group/add").put(addToGroup);
router.route("/group/remove").put(removeFromGroup);
router.route("/group/leave").put(leaveGroup);
router
  .route("/group/image")
  .put(documentUploadMiddleware.single("media"), updateGroupImage);

// Message endpoints
router
  .route("/message")
  .post(documentUploadMiddleware.array("media", 10), sendMessage)
  .put(editMessage)
  .delete(deleteMessage);

router.route("/message/forward").post(forwardMessages);
router.route("/message/bulk-delete").delete(deleteMultipleMessages);
router.route("/message/:chatId").get(getMessages);
router.route("/message/read/:chatId").put(markAsRead);
router.route("/message/search/:chatId").get(searchMessagesInChat);

export default router;
