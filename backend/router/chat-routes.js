import { Router } from "express";
import { upload } from "../middlewares/multer.js";
import { isLoggedIn } from "../middlewares/isLoggedIn.js";
import wrapAsync from "../utils/wrapAsync.js";
import {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  sendMessage,
  allMessages,
  searchUsers,
  markAsRead,
  getUnreadCount,
  editMessage,
  deleteMessage,
} from "../controllers/chat-controller.js";

const router = Router();

router.route("/").post(isLoggedIn, wrapAsync(accessChat));
router.route("/").get(isLoggedIn, wrapAsync(fetchChats));
router
  .route("/group")
  .post(isLoggedIn, upload.single("groupImage"), wrapAsync(createGroupChat));
router.route("/rename").put(isLoggedIn, wrapAsync(renameGroup));
router.route("/groupadd").put(isLoggedIn, wrapAsync(addToGroup));
router.route("/groupremove").put(isLoggedIn, wrapAsync(removeFromGroup));
router
  .route("/message")
  .post(isLoggedIn, upload.single("media"), wrapAsync(sendMessage));
router.route("/message/:chatId").get(isLoggedIn, wrapAsync(allMessages));
router.route("/search").get(isLoggedIn, wrapAsync(searchUsers));
router.route("/mark-read").post(isLoggedIn, wrapAsync(markAsRead));
router.route("/unread-count").get(isLoggedIn, wrapAsync(getUnreadCount));
router.route("/message/edit").put(isLoggedIn, wrapAsync(editMessage));
router.route("/message/delete").delete(isLoggedIn, wrapAsync(deleteMessage));

export { router as chatRouter };
